// Client-only: Este módulo usa la Web Serial API y solo funciona en el navegador.

import { normalizeEID } from './eid';

// ─── Type augmentation para Web Serial API ───────────────────────────────────
// TypeScript no incluye tipos para la Web Serial API por defecto.
// Declaramos los tipos mínimos necesarios para interactuar con ella.

declare global {
  interface Navigator {
    serial: Serial;
  }

  interface Serial extends EventTarget {
    requestPort(options?: SerialPortRequestOptions): Promise<SerialPort>;
    getPorts(): Promise<SerialPort[]>;
  }

  interface SerialPortRequestOptions {
    filters?: SerialPortFilter[];
  }

  interface SerialPortFilter {
    usbVendorId?: number;
    usbProductId?: number;
    bluetoothServiceClassId?: number | string;
  }

  interface SerialPort extends EventTarget {
    readable: ReadableStream<Uint8Array> | null;
    writable: WritableStream<Uint8Array> | null;
    open(options: SerialOptions): Promise<void>;
    close(): Promise<void>;
    getInfo(): SerialPortInfo;
  }

  interface SerialOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }

  interface SerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }
}

// ─── Tipos del servicio ──────────────────────────────────────────────────────

export type EIDReaderStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reading'
  | 'error';

type StatusChangeCallback = (status: EIDReaderStatus) => void;

const BAUD_RATE = 9600;

// Parámetros de línea del Tru-Test XRS2i/SRS2: 9600 8N1, sin control de flujo.
const SERIAL_OPTIONS: SerialOptions = {
  baudRate: BAUD_RATE,
  dataBits: 8,
  stopBits: 1,
  parity: 'none',
  bufferSize: 8192,
  flowControl: 'none',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Error interno para señalar que el dispositivo cerró el stream y conviene
// intentar reconectar (en vez de terminar el bucle en silencio).
class StreamClosedError extends Error {
  constructor() {
    super('El dispositivo cerró el stream serial.');
    this.name = 'StreamClosedError';
  }
}

// ─── EIDReaderService ────────────────────────────────────────────────────────

export class EIDReaderService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private readableStreamClosed: Promise<void> | null = null;
  private status: EIDReaderStatus = 'disconnected';
  private statusListeners: Set<StatusChangeCallback> = new Set();
  private abortController: AbortController | null = null;
  private readingActive = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 6;
  private reconnecting = false;
  // true cuando el usuario pidió desconectar: evita reconexiones automáticas.
  private userDisconnected = false;
  private disconnectListenerAttached = false;
  private onEIDCallback: ((eid: string) => void) | null = null;
  private onErrorCallback: ((error: Error) => void) | null = null;

  static isSupported(): boolean {
    return (
      typeof window !== 'undefined' &&
      'serial' in navigator &&
      typeof navigator.serial?.requestPort === 'function'
    );
  }

  async connect(): Promise<void> {
    if (this.status === 'connected' || this.status === 'reading') {
      return;
    }

    this.userDisconnected = false;
    this.setStatus('connecting');

    try {
      // Sin filtro: en Windows el bastón Tru-Test se expone como un puerto COM
      // normal (ej. COM7) y NO con la clase de servicio Bluetooth SPP, por lo que
      // filtrar por bluetoothServiceClassId lo oculta del selector de Chrome
      // ("No se encontraron dispositivos compatibles"). Pedimos todos los puertos
      // serie para que el COM del XRS2i aparezca y el usuario lo elija.
      this.port = await navigator.serial.requestPort();

      this.attachDisconnectListener();
      await this.openPort();

      this.reconnectAttempts = 0;
      this.setStatus('connected');
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  // Abre el puerto físico (COM saliente del bastón). Mantenerlo abierto es lo
  // que evita que el XRS2i suelte el enlace Bluetooth y se re-anuncie en ciclo.
  private async openPort(): Promise<void> {
    if (!this.port) throw new Error('No hay puerto seleccionado.');
    await this.port.open(SERIAL_OPTIONS);
  }

  // Se registra una sola vez sobre el objeto SerialPort. El evento 'disconnect'
  // lo dispara el navegador cuando el dispositivo desaparece (fuera de rango,
  // se apaga, etc.). Solo reconectamos si la desconexión no fue pedida por el usuario.
  private attachDisconnectListener(): void {
    if (!this.port || this.disconnectListenerAttached) return;
    this.disconnectListenerAttached = true;
    this.port.addEventListener('disconnect', () => {
      console.warn('Puerto serial: evento disconnect');
      if (!this.userDisconnected) {
        void this.attemptReconnect();
      }
    });
  }

  async disconnect(): Promise<void> {
    // Marca desconexión intencional: corta cualquier reintento automático.
    this.userDisconnected = true;
    this.reconnecting = false;

    await this.teardownReader();

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // El puerto puede ya estar cerrado.
      }
    }
    // No anulamos this.port para poder reabrir el mismo dispositivo sin volver
    // a pedir permiso; se reemplaza en el próximo connect().

    this.setStatus('disconnected');
  }

  async startReading(
    onEID: (eid: string) => void,
    onError?: (error: Error) => void
  ): Promise<void> {
    if (!this.port?.readable) {
      throw new Error('Puerto serial no conectado. Llame a connect() primero.');
    }

    if (this.readingActive) {
      return;
    }

    this.onEIDCallback = onEID;
    this.onErrorCallback = onError ?? null;
    this.userDisconnected = false;

    this.beginReadLoop();
  }

  // Inicia (o reanuda) el bucle de lectura sobre el puerto ya abierto.
  // Reutilizable tras una reconexión sin volver a registrar callbacks.
  private beginReadLoop(): void {
    if (!this.port?.readable) return;
    if (this.readingActive) return;

    this.readingActive = true;
    this.abortController = new AbortController();
    this.setStatus('reading');

    // TextDecoderStream convierte los bytes crudos del puerto a texto.
    const textDecoder = new TextDecoderStream();
    this.readableStreamClosed = this.port.readable.pipeTo(
      textDecoder.writable as WritableStream<Uint8Array>,
      { signal: this.abortController.signal }
    );
    // Evita "unhandled rejection" cuando el stream se corta por una caída.
    this.readableStreamClosed.catch(() => {});

    this.reader = textDecoder.readable.getReader();

    // Buffer para acumular datos parciales: un EID puede llegar partido en
    // varios chunks. El XRS2i termina cada lectura en \r\n.
    let buffer = '';

    const readLoop = async (): Promise<void> => {
      try {
        while (this.readingActive) {
          const { value, done } = await this.reader!.read();

          if (done) {
            // El dispositivo cerró el stream (caída transitoria del enlace).
            // No detenemos en silencio: intentamos reconectar de forma controlada.
            throw new StreamClosedError();
          }
          if (!value) continue;

          buffer += value;

          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex);
            buffer = buffer.slice(newlineIndex + 1);

            // Normaliza cualquier formato decimal (incluye Decimal con espacio).
            const eid = normalizeEID(line);
            if (eid) {
              this.onEIDCallback?.(eid);
            }
          }
        }
      } catch (error) {
        // Cancelación intencional (stopReading / disconnect): no es un error.
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }

        // Limpieza del lector actual antes de decidir si reconectar.
        await this.teardownReader();

        if (!this.userDisconnected) {
          void this.attemptReconnect();
        }
      }
    };

    void readLoop();
  }

  // Reconexión controlada: cierra bien el puerto, espera con backoff y lo
  // reabre, reanudando la lectura. Reemplaza al viejo handleDisconnection()
  // que forcejeaba abriendo un puerto ya inválido.
  private async attemptReconnect(): Promise<void> {
    if (this.reconnecting || this.userDisconnected) return;
    this.reconnecting = true;

    await this.teardownReader();

    while (
      this.reconnectAttempts < this.maxReconnectAttempts &&
      !this.userDisconnected
    ) {
      this.reconnectAttempts++;
      this.setStatus('connecting');

      const delay = Math.min(1000 * 2 ** (this.reconnectAttempts - 1), 8000);
      console.log(
        `Reintento de conexión ${this.reconnectAttempts}/${this.maxReconnectAttempts} en ${delay}ms...`
      );
      await sleep(delay);

      if (this.userDisconnected) break;

      try {
        // Aseguramos que esté cerrado antes de reabrir (evita InvalidStateError).
        try {
          await this.port?.close();
        } catch {
          // ya cerrado
        }

        await this.openPort();

        this.reconnectAttempts = 0;
        this.reconnecting = false;
        this.setStatus('connected');

        // Reanudar la lectura si había una sesión activa.
        if (this.onEIDCallback) {
          this.beginReadLoop();
        }
        return;
      } catch (err) {
        console.warn(`Reconexión fallida (intento ${this.reconnectAttempts})`, err);
      }
    }

    this.reconnecting = false;

    if (!this.userDisconnected) {
      this.setStatus('error');
      this.onErrorCallback?.(
        new Error('No se pudo restablecer la conexión con el bastón.')
      );
    }
  }

  // Cancela el bucle, libera el lock y espera que el pipe se cierre.
  private async teardownReader(): Promise<void> {
    this.readingActive = false;

    this.abortController?.abort();
    this.abortController = null;

    if (this.reader) {
      try {
        await this.reader.cancel();
      } catch {
        // puede fallar si ya está cerrado
      }
      try {
        this.reader.releaseLock();
      } catch {
        // el lock ya pudo liberarse
      }
      this.reader = null;
    }

    if (this.readableStreamClosed) {
      await this.readableStreamClosed.catch(() => {});
      this.readableStreamClosed = null;
    }
  }

  // Detiene la lectura pero deja el puerto abierto (sigue 'connected').
  async stopReading(): Promise<void> {
    this.userDisconnected = false;
    await this.teardownReader();
    if (this.port) {
      this.setStatus('connected');
    }
  }

  getStatus(): EIDReaderStatus {
    return this.status;
  }

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.statusListeners.add(callback);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private setStatus(newStatus: EIDReaderStatus): void {
    if (this.status === newStatus) return;
    this.status = newStatus;
    this.statusListeners.forEach((cb) => cb(newStatus));
  }
}
// Lector EID por Web Serial — Tru-Test XRS2i (COM7 / SPP) — rev. conexión estable


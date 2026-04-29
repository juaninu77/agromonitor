// Client-only: Este módulo usa la Web Serial API y solo funciona en el navegador.

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

// Bluetooth Classic SPP service class UUID
const BLUETOOTH_SPP_SERVICE_CLASS_ID = 0x1101;
const BAUD_RATE = 9600;

// ISO 11784/11785: EID es un número decimal de 15 o 16 dígitos
const EID_PATTERN = /^\d{15,16}$/;

// ─── EIDReaderService ────────────────────────────────────────────────────────

export class EIDReaderService {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private status: EIDReaderStatus = 'disconnected';
  private statusListeners: Set<StatusChangeCallback> = new Set();
  private abortController: AbortController | null = null;
  private readingActive = false;

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

    this.setStatus('connecting');

    try {
      this.port = await navigator.serial.requestPort({
        filters: [
          { bluetoothServiceClassId: BLUETOOTH_SPP_SERVICE_CLASS_ID },
        ],
      });

      await this.port.open({ baudRate: BAUD_RATE });
      this.setStatus('connected');
    } catch (error) {
      this.setStatus('error');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.stopReading();

    if (this.port) {
      try {
        await this.port.close();
      } catch {
        // El puerto puede ya estar cerrado
      }
      this.port = null;
    }

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

    this.readingActive = true;
    this.abortController = new AbortController();
    this.setStatus('reading');

    // TextDecoderStream convierte los bytes crudos del puerto serial a texto UTF-8.
    // pipeTo conecta el readable del puerto al decoder, usando el signal para poder cancelar.
    const textDecoder = new TextDecoderStream();
    const readableStreamClosed = this.port.readable.pipeTo(
      textDecoder.writable as WritableStream<Uint8Array>,
      { signal: this.abortController.signal }
    );

    this.reader = textDecoder.readable.getReader();

    // Buffer para acumular datos parciales entre lecturas.
    // El SRS2 envía EIDs terminados en \r\n, pero una lectura del stream
    // puede cortar un EID a la mitad si llega en múltiples chunks.
    let buffer = '';

    const readLoop = async () => {
      try {
        while (this.readingActive) {
          const { value, done } = await this.reader!.read();

          if (done) break;
          if (!value) continue;

          buffer += value;

          // Procesar todas las líneas completas del buffer
          let newlineIndex: number;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).replace(/\r$/, '').trim();
            buffer = buffer.slice(newlineIndex + 1);

            if (line && EID_PATTERN.test(line)) {
              onEID(line);
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          return;
        }
        this.setStatus('error');
        onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    };

    readLoop().finally(async () => {
      this.reader?.releaseLock();
      this.reader = null;
      await readableStreamClosed.catch(() => {});
    });
  }

  async stopReading(): Promise<void> {
    this.readingActive = false;
    this.abortController?.abort();
    this.abortController = null;

    if (this.reader) {
      try {
        this.reader.releaseLock();
      } catch {
        // Puede fallar si el lock ya fue liberado
      }
      this.reader = null;
    }

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

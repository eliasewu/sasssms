declare module "smpp" {
  import { EventEmitter } from "events";
  
  export class PDU {
    command: string;
    command_status: number;
    sequence_number: number;
    system_id?: string;
    password?: string;
    system_type?: string;
    source_addr?: string;
    destination_addr?: string;
    short_message?: { message: string };
    esm_class?: number;
    registered_delivery?: number;
    data_coding?: number;
    message_id?: string;
    
    constructor(command: string, options?: Record<string, unknown>);
    response(options?: Record<string, unknown>): PDU;
  }

  export interface ServerSession extends EventEmitter {
    send(pdu: PDU): void;
    close(): void;
  }

  export function createServer(
    callback: (session: ServerSession) => void
  ): { listen: (port: number, callback?: () => void) => void };
}

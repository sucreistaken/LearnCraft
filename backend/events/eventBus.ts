import { EventEmitter } from "events";
import { EventMap, EventName } from "./eventTypes";

class TypedEventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(50);
  }

  emit<K extends EventName>(event: K, data: EventMap[K]): void {
    this.emitter.emit(event, data);
  }

  on<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.on(event, handler);
  }

  off<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.off(event, handler);
  }

  once<K extends EventName>(event: K, handler: (data: EventMap[K]) => void): void {
    this.emitter.once(event, handler);
  }
}

export const eventBus = new TypedEventBus();

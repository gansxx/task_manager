import type { TaskLifecycleEvent, TaskLifecycleEventType } from "./types";

type TaskLifecycleHandler = (
  event: TaskLifecycleEvent,
) => Promise<void> | void;

export class TaskEventPipeline {
  private readonly handlers = new Map<
    TaskLifecycleEventType,
    TaskLifecycleHandler[]
  >();

  on(
    eventType: TaskLifecycleEventType,
    handler: TaskLifecycleHandler,
  ): void {
    const current = this.handlers.get(eventType) ?? [];
    current.push(handler);
    this.handlers.set(eventType, current);
  }

  async emit(event: TaskLifecycleEvent): Promise<void> {
    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      await handler(event);
    }
  }
}

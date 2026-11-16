/**
 * Runs database operations strictly one after another.
 *
 * expo-sqlite's withTransactionAsync is not exclusive: any query that runs while a transaction
 * is open becomes part of it (and is undone if it rolls back). So every service that writes
 * to the database shares ONE queue, created once in ServicesProvider, and no two operations
 * can ever interleave inside each other's transactions.
 */
export class OperationQueue {
  /** The tail of the queue: each new operation waits for the previous one to settle. */
  private tail: Promise<unknown> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const result = this.tail.then(task, task);
    this.tail = result.catch(() => undefined); // a failure must not block later operations
    return result;
  }
}

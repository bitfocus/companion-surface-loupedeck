/**
 * A small coalescing write queue, modelled on Companion's ImageWriteQueue.
 *
 * Draw jobs are keyed; while a job for a key is in flight, further queue() calls for the same key
 * overwrite the pending job (only the latest value is kept). This stops rapid updates - eg dragging a
 * fader or repainting a strip cell - from piling up and falling behind the device's draw speed.
 * Different keys run concurrently.
 */
export class ImageWriteQueue<TKey, TItem> {
	readonly #worker: (key: TKey, item: TItem) => Promise<void>
	readonly #onError: (key: TKey, e: unknown) => void

	readonly #running = new Set<TKey>()
	readonly #pending = new Map<TKey, TItem>()

	constructor(worker: (key: TKey, item: TItem) => Promise<void>, onError: (key: TKey, e: unknown) => void) {
		this.#worker = worker
		this.#onError = onError
	}

	/** Queue (or replace the pending) draw for a key */
	queue(key: TKey, item: TItem): void {
		this.#pending.set(key, item)
		if (!this.#running.has(key)) void this.#run(key)
	}

	async #run(key: TKey): Promise<void> {
		this.#running.add(key)
		try {
			// Keep draining until nothing new is pending for this key
			while (this.#pending.has(key)) {
				const item = this.#pending.get(key) as TItem
				this.#pending.delete(key)
				try {
					await this.#worker(key, item)
				} catch (e) {
					this.#onError(key, e)
				}
			}
		} finally {
			this.#running.delete(key)
		}
	}
}

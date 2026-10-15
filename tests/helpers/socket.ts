// A controllable transport boundary. Production normalization and handlers run unchanged.
export class TestSocket {
  static OPEN = 1
  static CONNECTING = 0
  static CLOSED = 3
  static instances: TestSocket[] = []
  readyState = TestSocket.CONNECTING
  sent: string[] = []
  closes: Array<{ code?: number; reason?: string }> = []
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: CloseEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(
    readonly url: string,
    readonly protocols: string[]
  ) {
    TestSocket.instances.push(this)
  }

  open() {
    this.readyState = TestSocket.OPEN
    this.onopen?.()
  }

  receive(data: unknown) {
    this.receiveRaw(JSON.stringify(data))
  }

  receiveRaw(data: string) {
    this.onmessage?.(new MessageEvent("message", { data }))
  }

  send(data: string) {
    if (this.readyState !== TestSocket.OPEN)
      throw new Error("Socket is not open")
    this.sent.push(data)
  }

  close(code = 1000, reason = "") {
    this.closes.push({ code, reason })
    this.readyState = TestSocket.CLOSED
    this.onclose?.(new CloseEvent("close", { code, reason }))
  }
}

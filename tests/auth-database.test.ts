// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import type { Pool } from "pg"
import { createAuthDatabase } from "@/lib/auth-database"

// Mocked command-result tests complement the real PostgreSQL integration suite.
describe("authentication transaction command verification (mocked pg)", () => {
  it.each(["ROLLBACK", "UNKNOWN"])(
    "rejects a COMMIT returning %s",
    async (command) => {
      const release = vi.fn()
      const query = vi.fn(async (sql: string) => ({
        command: sql === "COMMIT" ? command : sql.split(" ")[0],
      }))
      const pool = {
        connect: async () => ({ query, release }),
      } as unknown as Pool
      await expect(
        createAuthDatabase(pool).reset(
          "token",
          async () => Response.json({ status: true }),
          (response) => response.ok
        )
      ).rejects.toThrow("Unexpected authentication transaction result")
      expect(query).toHaveBeenCalledWith("ROLLBACK")
      expect(release).toHaveBeenCalledWith(false)
    }
  )

  it("destroys the connection if rollback fails", async () => {
    const release = vi.fn()
    const query = vi.fn(async (sql: string) => {
      if (sql === "ROLLBACK") throw new Error("disconnected")
      return { command: sql.split(" ")[0] }
    })
    const pool = {
      connect: async () => ({ query, release }),
    } as unknown as Pool
    await expect(
      createAuthDatabase(pool).login(
        async () => {
          throw new Error("operation failed")
        },
        () => true
      )
    ).rejects.toThrow("operation failed")
    expect(release).toHaveBeenCalledWith(true)
  })
})

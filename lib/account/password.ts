import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

const scryptAsync = promisify(scrypt)
const KEY_LENGTH = 64

export async function hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString("hex")
    const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
    return `scrypt$${salt}$${key.toString("hex")}`
}

export async function verifyPassword(
    password: string,
    stored: string,
): Promise<boolean> {
    const [algorithm, salt, hash] = stored.split("$")
    if (algorithm !== "scrypt" || !salt || !hash) return false
    const key = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
    const expected = Buffer.from(hash, "hex")
    return key.length === expected.length && timingSafeEqual(key, expected)
}

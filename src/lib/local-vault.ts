'use client'

// Client-side vault storage using Tauri invoke() calls.
// Vault location is a string path stored in localStorage.

import { invoke } from '@tauri-apps/api/core'

const VAULT_PATH_KEY = 'mdnotebook-vault-path'

// ── Tauri invoke wrappers ──

export async function pickVaultFolder(): Promise<string> {
  const path = await invoke<string>('pick_vault_folder')
  setStoredVaultPath(path)
  return path
}

export async function readVaultFile(folder: string): Promise<string | null> {
  return invoke<string | null>('read_vault_file', { folder })
}

export async function writeVaultFile(folder: string, data: string): Promise<void> {
  return invoke<void>('write_vault_file', { folder, data })
}

export async function vaultFileExists(folder: string): Promise<boolean> {
  return invoke<boolean>('vault_file_exists', { folder })
}

// ── Path persistence (localStorage) ──

export function getStoredVaultPath(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(VAULT_PATH_KEY)
}

export function setStoredVaultPath(path: string): void {
  try {
    localStorage.setItem(VAULT_PATH_KEY, path)
  } catch {
    console.warn('Could not persist vault path to localStorage')
  }
}

export function clearStoredVaultPath(): void {
  localStorage.removeItem(VAULT_PATH_KEY)
}

// ── Vault status ──

export type VaultStatus =
  | { state: 'no-folder' }
  | { state: 'ready'; folder: string }

export async function checkVaultStatus(): Promise<VaultStatus> {
  const folder = getStoredVaultPath()
  if (!folder) {
    return { state: 'no-folder' }
  }
  return { state: 'ready', folder }
}

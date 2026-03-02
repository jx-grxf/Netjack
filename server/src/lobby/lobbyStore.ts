import { LobbyState } from '../types';

export class LobbyStore {
  private readonly lobbies = new Map<string, LobbyState>();

  get(code: string): LobbyState | undefined {
    return this.lobbies.get(code);
  }

  set(lobby: LobbyState): void {
    this.lobbies.set(lobby.code, lobby);
  }

  delete(code: string): void {
    this.lobbies.delete(code);
  }

  has(code: string): boolean {
    return this.lobbies.has(code);
  }

  getAll(): LobbyState[] {
    return [...this.lobbies.values()];
  }
}

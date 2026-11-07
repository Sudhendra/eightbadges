/**
 * The one place the site gets Pokémon art from. Sprites are The Pokémon Company's, and they're never committed
 * to this repo: the build fetches only those in use. To replace them all, change this file and rebuild.
 * Bump SPRITE_VERSION when the art changes, because browsers cache these files for a year.
 */
const POKEAPI_SPRITES_COMMIT = "1b3b7c0a538dd2226ae08d0d2f8955125075bbd4";
const SPRITE_VERSION = "e1";

export const SPRITE_SIZE = 64;

export function spritePath(dex: number): string {
  return `/s/${SPRITE_VERSION}/${dex}.png`;
}

export function spriteSourceUrl(dex: number): string {
  return `https://raw.githubusercontent.com/PokeAPI/sprites/${POKEAPI_SPRITES_COMMIT}/sprites/pokemon/versions/generation-iii/emerald/${dex}.png`;
}

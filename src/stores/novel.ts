import { defineStore } from "pinia";
import { ref } from "vue";
import type { Character } from "@/types";

export const useNovelStore = defineStore("novel", () => {
  // 角色管理
  const editingCharacter = ref<Character | null>(null);
  const isEditingWorld = ref(false);

  // 角色操作
  function saveCharacter(character: Character, characters: Character[]): Character[] {
    const index = characters.findIndex((c) => c.id === character.id);
    if (index >= 0) {
      const updated = [...characters];
      updated[index] = character;
      return updated;
    }
    return [...characters, character];
  }

  function deleteCharacter(characterId: string, characters: Character[]): Character[] {
    return characters.filter((c) => c.id !== characterId);
  }

  return {
    editingCharacter,
    isEditingWorld,
    saveCharacter,
    deleteCharacter,
  };
});

<template>
  <div class="world-setting">
    <div class="ws-header">
      <h3>世界观设定</h3>
      <el-button type="primary" size="small" @click="handleSave">
        保存
      </el-button>
    </div>

    <el-form label-position="top" size="small">
      <el-form-item label="世界观描述">
        <el-input
          v-model="localWorld.content"
          type="textarea"
          :rows="8"
          placeholder="描述这个世界的基本设定、历史背景、文明状态等..."
        />
      </el-form-item>

      <el-form-item label="地理环境">
        <el-input
          v-model="localWorld.geography"
          type="textarea"
          :rows="4"
          placeholder="描述世界的版图、重要地点、自然环境..."
        />
      </el-form-item>

      <el-divider content-position="left">势力组织</el-divider>

      <div v-for="(faction, index) in localWorld.factions" :key="index" class="faction-card">
        <el-row :gutter="12">
          <el-col :span="8">
            <el-input v-model="faction.name" placeholder="势力名称" />
          </el-col>
          <el-col :span="14">
            <el-input v-model="faction.description" placeholder="势力描述" />
          </el-col>
          <el-col :span="2">
            <el-button text type="danger" @click="removeFaction(index)">
              <el-icon><Icon icon="lucide:trash-2" /></el-icon>
            </el-button>
          </el-col>
        </el-row>
        <el-input
          v-model="faction.membersText"
          placeholder="成员（逗号分隔）"
          size="small"
          style="margin-top: 8px"
          @input="updateMembers(index)"
        />
      </div>

      <el-button size="small" @click="addFaction">
        <el-icon><Icon icon="lucide:building-2" /></el-icon>
        <span>添加势力</span>
      </el-button>

      <el-divider content-position="left">世界规则</el-divider>

      <div v-for="(_rule, index) in localWorld.rules" :key="index" class="rule-item">
        <el-input v-model="localWorld.rules[index]" placeholder="输入世界规则">
          <template #prefix>
            <el-icon><Icon icon="lucide:list" /></el-icon>
          </template>
          <template #suffix>
            <el-button text type="danger" size="small" @click="removeRule(index)">
              <el-icon><Icon icon="lucide:x" /></el-icon>
            </el-button>
          </template>
        </el-input>
      </div>

      <el-button size="small" @click="addRule" style="margin-top: 8px">
        <el-icon><Icon icon="lucide:list-plus" /></el-icon>
        <span>添加规则</span>
      </el-button>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { reactive, watch } from "vue";
import type { WorldSetting } from "@/types";

interface FactionWithMembersText {
  name: string;
  description: string;
  members: string[];
  membersText?: string;
}

const props = defineProps<{
  worldSetting: WorldSetting | null;
}>();

const emit = defineEmits<{
  save: [world: WorldSetting];
}>();

const localWorld = reactive<WorldSetting & { factions: FactionWithMembersText[] }>({
  content: "",
  factions: [] as FactionWithMembersText[],
  rules: [],
  geography: "",
});

// 监听 props 变化
watch(
  () => props.worldSetting,
  (val) => {
    if (val) {
      localWorld.content = val.content;
      localWorld.geography = val.geography;
      localWorld.rules = [...val.rules];
      localWorld.factions = val.factions.map((f) => ({
        ...f,
        membersText: f.members.join("、"),
      }));
    }
  },
  { immediate: true }
);

function addFaction() {
  localWorld.factions.push({
    name: "",
    description: "",
    members: [],
    membersText: "",
  });
}

function removeFaction(index: number) {
  localWorld.factions.splice(index, 1);
}

function updateMembers(index: number) {
  const text = localWorld.factions[index].membersText || "";
  localWorld.factions[index].members = text
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function addRule() {
  localWorld.rules.push("");
}

function removeRule(index: number) {
  localWorld.rules.splice(index, 1);
}

function handleSave() {
  const result: WorldSetting = {
    content: localWorld.content,
    geography: localWorld.geography,
    rules: [...localWorld.rules],
    factions: localWorld.factions.map((f) => ({
      name: f.name,
      description: f.description,
      members: f.members,
    })),
  };
  emit("save", result);
}
</script>

<style scoped>
.world-setting {
  padding: 16px;
}

.ws-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.ws-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.faction-card {
  padding: 12px;
  background: #fafafa;
  border-radius: 8px;
  margin-bottom: 8px;
}

.rule-item {
  margin-bottom: 8px;
}
</style>

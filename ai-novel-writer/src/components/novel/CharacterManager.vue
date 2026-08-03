<template>
  <div class="character-manager">
    <div class="cm-header">
      <h3>角色管理</h3>
      <el-button type="primary" size="small" @click="showDialog = true">
        <el-icon><Icon icon="lucide:user-plus" /></el-icon>
        <span>新增角色</span>
      </el-button>
    </div>

    <!-- 角色列表 -->
    <div v-if="characters.length === 0" class="cm-empty">
      <p>暂无角色，点击上方按钮创建</p>
      <el-button size="small" @click="generateByAI">
        <el-icon><Icon icon="lucide:sparkles" /></el-icon>
        AI 一键生成角色
      </el-button>
    </div>

    <div v-else class="character-list">
      <div
        v-for="char in characters"
        :key="char.id"
        class="character-card"
        @click="editCharacter(char)"
      >
        <div class="char-avatar">{{ char.name.charAt(0) }}</div>
        <div class="char-info">
          <div class="char-name">{{ char.name }}</div>
          <div class="char-brief">{{ char.personality?.slice(0, 30) }}</div>
        </div>
        <el-tooltip content="删除角色" placement="top">
          <el-button
            text
            size="small"
            class="char-delete-btn"
            @click.stop="handleDelete(char)"
          >
            <el-icon><Icon icon="lucide:trash-2" /></el-icon>
          </el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 角色编辑对话框 -->
    <el-dialog v-model="showDialog" :title="editingId ? '编辑角色' : '新增角色'" width="600px">
      <el-form :model="form" label-width="80px" size="small">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="姓名" required>
              <el-input v-model="form.name" placeholder="角色姓名" />
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="性别">
              <el-select v-model="form.gender" placeholder="性别">
                <el-option label="男" value="男" />
                <el-option label="女" value="女" />
                <el-option label="未知" value="未知" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="6">
            <el-form-item label="年龄">
              <el-input v-model="form.age" placeholder="年龄" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="性格">
          <el-input v-model="form.personality" type="textarea" :rows="2" placeholder="性格描述" />
        </el-form-item>
        <el-form-item label="外貌">
          <el-input v-model="form.appearance" type="textarea" :rows="2" placeholder="外貌描述" />
        </el-form-item>
        <el-form-item label="背景">
          <el-input v-model="form.background" type="textarea" :rows="3" placeholder="角色背景故事" />
        </el-form-item>
        <el-form-item label="关系">
          <el-input v-model="form.relationships" type="textarea" :rows="2" placeholder="与其他角色的关系" />
        </el-form-item>
        <el-form-item label="口头禅">
          <el-input v-model="form.speech_pattern" placeholder="角色常用的口头禅或说话风格" />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="form.notes" type="textarea" :rows="2" placeholder="其他备注" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button v-if="editingId" type="danger" plain @click="handleDeleteFromDialog">
          删除角色
        </el-button>
        <el-button @click="showDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { Character } from "@/types";

const props = defineProps<{
  characters: Character[];
  projectId: string;
}>();

const emit = defineEmits<{
  save: [character: Character];
  delete: [id: string];
}>();

const showDialog = ref(false);
const editingId = ref<string | null>(null);
const form = reactive<Character>({
  id: "",
  name: "",
  gender: "未知",
  age: "",
  personality: "",
  appearance: "",
  background: "",
  relationships: "",
  speech_pattern: "",
  notes: "",
});

function editCharacter(char: Character) {
  editingId.value = char.id;
  Object.assign(form, char);
  showDialog.value = true;
}

function handleSave() {
  if (!form.name.trim()) return;

  if (!editingId.value) {
    form.id = `char_${Date.now()}`;
  }

  emit("save", { ...form });
  showDialog.value = false;
  resetForm();
}

/** 删除角色（卡片上的删除按钮） */
async function handleDelete(char: Character) {
  try {
    await ElMessageBox.confirm(
      `确定删除角色「${char.name}」吗？\n删除后无法恢复。`,
      "删除确认",
      { confirmButtonText: "删除", cancelButtonText: "取消", type: "warning" }
    );
  } catch {
    return;
  }
  emit("delete", char.id);
  if (editingId.value === char.id) {
    showDialog.value = false;
    resetForm();
  }
}

/** 删除角色（编辑弹窗里的删除按钮） */
async function handleDeleteFromDialog() {
  if (!editingId.value) return;
  const name = form.name.trim() || "该角色";
  try {
    await ElMessageBox.confirm(
      `确定删除角色「${name}」吗？\n删除后无法恢复。`,
      "删除确认",
      { confirmButtonText: "删除", cancelButtonText: "取消", type: "warning" }
    );
  } catch {
    return;
  }
  emit("delete", editingId.value);
  showDialog.value = false;
  resetForm();
}

function resetForm() {
  editingId.value = null;
  Object.assign(form, {
    id: "",
    name: "",
    gender: "未知",
    age: "",
    personality: "",
    appearance: "",
    background: "",
    relationships: "",
    speech_pattern: "",
    notes: "",
  });
}

async function generateByAI() {
  try {
    const { useAIStore } = await import("@/stores/ai");
    const aiStore = useAIStore();
    const existingChars = props.characters.map((c) => c.name).join("、");
    const prompt = `请为一篇网络小说生成一个角色。\n已存在的角色：${existingChars || "无"}\n\n请生成一个全新的角色，包含以下信息：\n- name: 姓名\n- gender: 性别\n- age: 年龄\n- personality: 性格描述（20字左右）\n- appearance: 外貌描述\n- background: 背景故事\n- relationships: 与其他角色的关系\n- speech_pattern: 口头禅或说话风格\n\n直接输出 JSON 格式，不要加其他说明。`;
    const resp = await aiStore.sendMessage(prompt);
    // 尝试从返回中提取 JSON
    const jsonMatch = resp.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      const newChar: Character = {
        id: `char_${Date.now()}`,
        name: data.name || "新角色",
        gender: data.gender || "未知",
        age: data.age || "",
        personality: data.personality || "",
        appearance: data.appearance || "",
        background: data.background || "",
        relationships: data.relationships || "",
        speech_pattern: data.speech_pattern || "",
        notes: "",
      };
      emit("save", newChar);
      ElMessage.success(`AI 已生成角色「${newChar.name}」`);
    } else {
      ElMessage.warning("AI 返回格式异常，请重试");
    }
  } catch (e) {
    ElMessage.error("AI 生成失败: " + e);
  }
}
</script>

<style scoped>
.character-manager {
  padding: 16px;
}

.cm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.cm-header h3 {
  font-size: 16px;
  font-weight: 600;
}

.cm-empty {
  text-align: center;
  padding: 40px 20px;
  color: #909399;
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;
}

.character-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.character-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.2s;
}

.character-card:hover {
  background: #f5f7fa;
}

.char-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 600;
  flex-shrink: 0;
}

.char-info {
  flex: 1;
  min-width: 0;
}

.char-name {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}

.char-brief {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 删除按钮：默认隐藏，hover 卡片时显示 */
.char-delete-btn {
  width: 26px;
  height: 26px;
  padding: 0;
  color: #c0c4cc;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s, color 0.15s;
}

.character-card:hover .char-delete-btn {
  opacity: 1;
}

.char-delete-btn:hover {
  color: #f56c6c !important;
  background: #fef0f0 !important;
}
</style>

<template>
  <div class="skill-selector">
    <!-- 顶部：搜索 + 管理入口 -->
    <div class="ss-toolbar">
      <el-input
        v-model="skillStore.searchQuery"
        placeholder="搜索技能..."
        size="small"
        clearable
        prefix-icon="Search"
        class="ss-search"
      />
      <el-tooltip content="技能市场：导入 / 导出 / 管理自定义技能" placement="bottom">
        <el-button size="small" class="ss-manage-btn" @click="showManager = true">
          <el-icon><Icon icon="lucide:store" /></el-icon>
        </el-button>
      </el-tooltip>
    </div>

    <!-- 分类标签 -->
    <div class="ss-categories">
      <el-tag
        :type="skillStore.activeCategory === null ? 'primary' : 'info'"
        size="small"
        class="ss-cat-tag"
        effect="plain"
        @click="skillStore.setCategory(null)"
      >
        全部
      </el-tag>
      <el-tag
        v-for="cat in skillStore.activeCategories"
        :key="cat.key"
        :type="skillStore.activeCategory === cat.key ? 'primary' : 'info'"
        size="small"
        class="ss-cat-tag"
        effect="plain"
        @click="skillStore.setCategory(cat.key)"
      >
        <el-icon :size="14" style="vertical-align: -2px"><Icon :icon="cat.icon" /></el-icon> {{ cat.label }}
        <span class="cat-count">{{ cat.count }}</span>
      </el-tag>
    </div>

    <!-- 技能列表 -->
    <div class="ss-list">
      <div v-if="Object.keys(skillStore.categorizedSkills).length === 0" class="ss-empty">
        <el-empty description="没有匹配的技能" :image-size="60" />
      </div>

      <template v-for="(skills, category) in skillStore.categorizedSkills" :key="category">
        <div v-if="!skillStore.activeCategory" class="ss-group-label">
          <el-icon :size="14" style="vertical-align: -2px">
            <Icon :icon="SKILL_CATEGORIES[category as keyof typeof SKILL_CATEGORIES]?.icon" />
          </el-icon>
          {{ SKILL_CATEGORIES[category as keyof typeof SKILL_CATEGORIES]?.label }}
          <span class="ss-group-count">{{ skills.length }}</span>
        </div>

        <div
          v-for="skill in skills"
          :key="skill.id"
          class="ss-item"
          :class="{ active: skillStore.activeSkillId === skill.id }"
          @click="skillStore.selectSkill(skill.id)"
        >
          <div class="ss-item-icon">
            <Icon v-if="skill.icon" :icon="skill.icon" :width="22" :height="22" />
            <span v-else>{{ skill.emoji }}</span>
          </div>
          <div class="ss-item-body">
            <div class="ss-item-name-row">
              <span class="ss-item-name">{{ skill.name }}</span>
              <el-tag
                v-if="skill.source === 'builtin'"
                size="small"
                type="primary"
                effect="plain"
                class="ss-source-tag"
              >官方</el-tag>
              <el-tag
                v-else
                size="small"
                type="warning"
                effect="plain"
                class="ss-source-tag"
              >自定义</el-tag>
            </div>
            <div class="ss-item-desc">{{ skill.description }}</div>
            <div class="ss-item-tags">
              <el-tag
                v-for="tag in skill.tags"
                :key="tag"
                size="small"
                type="info"
                class="ss-tag"
              >
                {{ tag }}
              </el-tag>
              <span v-if="skill.author" class="ss-author">{{ skill.author }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 技能市场管理弹窗 -->
    <SkillManagerDialog v-model:visible="showManager" />
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { Icon } from "@iconify/vue";
import { useSkillStore } from "@/skills/store";
import { SKILL_CATEGORIES } from "@/skills/types";
import SkillManagerDialog from "@/components/ai/SkillManagerDialog.vue";

const skillStore = useSkillStore();
const showManager = ref(false);
</script>

<style scoped>
.skill-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ss-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 4px;
}

.ss-search {
  flex: 1;
  min-width: 0;
}

.ss-manage-btn {
  flex-shrink: 0;
}

.ss-categories {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 0 4px;
}

.ss-cat-tag {
  cursor: pointer;
}

.cat-count {
  font-size: 11px;
  opacity: 0.6;
  margin-left: 2px;
}

.ss-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 360px;
  overflow-y: auto;
  padding: 4px 0;
}

.ss-empty {
  padding: 20px 0;
}

.ss-group-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  padding: 8px 8px 4px;
  border-bottom: 1px solid var(--border);
  margin-top: 4px;
}

.ss-group-count {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
  margin-left: 4px;
}

.ss-item {
  display: flex;
  gap: 10px;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.ss-item:hover {
  background: var(--panel-hover);
}

.ss-item.active {
  background: var(--accent-soft);
  border: 1px solid var(--accent);
}

.ss-item-icon {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--accent);
}

.ss-item-body {
  flex: 1;
  min-width: 0;
}

.ss-item-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ss-item-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-1);
}

.ss-source-tag {
  flex-shrink: 0;
}

.ss-item-desc {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ss-item-tags {
  display: flex;
  gap: 4px;
  margin-top: 4px;
  flex-wrap: wrap;
  align-items: center;
}

.ss-tag {
  font-size: 10px !important;
  height: auto !important;
  line-height: 1.4 !important;
  padding: 0 4px !important;
}

.ss-author {
  font-size: 11px;
  color: var(--text-3);
}
</style>

<template>
  <div class="skill-selector">
    <!-- 搜索框 -->
    <div class="ss-search">
      <el-input
        v-model="skillStore.searchQuery"
        placeholder="搜索技能..."
        size="small"
        clearable
        prefix-icon="Search"
      />
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
        {{ cat.emoji }} {{ cat.label }}
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
          {{ SKILL_CATEGORIES[category as keyof typeof SKILL_CATEGORIES]?.emoji }}
          {{ SKILL_CATEGORIES[category as keyof typeof SKILL_CATEGORIES]?.label }}
        </div>

        <div
          v-for="skill in skills"
          :key="skill.id"
          class="ss-item"
          :class="{ active: skillStore.activeSkillId === skill.id }"
          @click="skillStore.selectSkill(skill.id)"
        >
          <div class="ss-item-icon">{{ skill.emoji }}</div>
          <div class="ss-item-body">
            <div class="ss-item-name">{{ skill.name }}</div>
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
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useSkillStore } from "@/skills/store";
import { SKILL_CATEGORIES } from "@/skills/types";

const skillStore = useSkillStore();
</script>

<style scoped>
.skill-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ss-search {
  padding: 0 4px;
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
  color: #909399;
  padding: 8px 8px 4px;
  border-bottom: 1px solid #f0f0f0;
  margin-top: 4px;
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
  background: #f5f7fa;
}

.ss-item.active {
  background: #ecf5ff;
  border: 1px solid #d9ecff;
}

.ss-item-icon {
  font-size: 24px;
  line-height: 1;
  flex-shrink: 0;
  padding-top: 2px;
}

.ss-item-body {
  flex: 1;
  min-width: 0;
}

.ss-item-name {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 2px;
}

.ss-item-desc {
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
  margin-bottom: 4px;
}

.ss-item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ss-tag {
  font-size: 10px !important;
  height: auto !important;
  line-height: 1.4 !important;
  padding: 0 4px !important;
}
</style>

import { describe, it, expect } from "vitest";
import {
  parseSkillMarkdown,
  serializeSkillMarkdown,
  skillDirName,
} from "../skillMarkdown";
import type { WritingSkill } from "@/skills/types";

const SAMPLE_MD = `---
id: my-char-skill
name: 角色塑造大师
description: 深度角色塑造辅助
emoji: 🎭
icon: lucide:user
category: character
tags:
  - 角色
  - 人设
when: 需要塑造复杂角色时
version: 1.2.0
author: 张三
homepage: https://example.com/skill
---
你是角色塑造专家，请帮助作者设计有血有肉的角色。
注意避免扁平化、工具化。
`;

describe("parseSkillMarkdown", () => {
  it("解析 frontmatter 和 body", () => {
    const skill = parseSkillMarkdown(SAMPLE_MD);
    expect(skill.id).toBe("my-char-skill");
    expect(skill.name).toBe("角色塑造大师");
    expect(skill.description).toBe("深度角色塑造辅助");
    expect(skill.emoji).toBe("🎭");
    expect(skill.icon).toBe("lucide:user");
    expect(skill.category).toBe("character");
    expect(skill.tags).toEqual(["角色", "人设"]);
    expect(skill.when).toBe("需要塑造复杂角色时");
    expect(skill.version).toBe("1.2.0");
    expect(skill.author).toBe("张三");
    expect(skill.homepage).toBe("https://example.com/skill");
    expect(skill.source).toBe("custom");
    expect(skill.systemPrompt).toContain("角色塑造专家");
    expect(skill.enabled).toBe(true);
  });

  it("无 frontmatter 时使用默认值", () => {
    const skill = parseSkillMarkdown("纯正文内容");
    expect(skill.source).toBe("custom");
    expect(skill.category).toBe("writing");
    expect(skill.name).toBe("未命名技能");
    expect(skill.systemPrompt).toBe("纯正文内容");
  });

  it("非法分类回退到 writing", () => {
    const md = `---\nid: x\nname: X\ncategory: invalid\n---\n正文`;
    const skill = parseSkillMarkdown(md);
    expect(skill.category).toBe("writing");
  });

  it("无 id 时自动生成", () => {
    const md = `---\nname: 无ID技能\n---\n正文`;
    const skill = parseSkillMarkdown(md);
    expect(skill.id).toMatch(/^custom-/);
  });
});

describe("serializeSkillMarkdown", () => {
  it("能往返序列化", () => {
    const skill: WritingSkill = {
      id: "round-trip",
      name: "往返测试",
      description: "测试描述",
      emoji: "🔄",
      icon: "lucide:refresh-cw",
      category: "utils",
      tags: ["测试", "往返"],
      when: "测试时",
      systemPrompt: "测试 system prompt 正文",
      enabled: true,
      version: "1.0.0",
      source: "custom",
      author: "测试作者",
    };
    const md = serializeSkillMarkdown(skill);
    const parsed = parseSkillMarkdown(md);
    expect(parsed.id).toBe("round-trip");
    expect(parsed.name).toBe("往返测试");
    expect(parsed.category).toBe("utils");
    expect(parsed.tags).toEqual(["测试", "往返"]);
    expect(parsed.author).toBe("测试作者");
    expect(parsed.systemPrompt).toBe("测试 system prompt 正文");
  });

  it("带特殊字符的标签能正确序列化", () => {
    const skill: WritingSkill = {
      id: "special",
      name: "特殊字符",
      description: "含 : 冒号",
      emoji: "✨",
      category: "writing",
      tags: ["含:冒号", "含-横线"],
      when: "",
      systemPrompt: "正文",
      enabled: true,
      version: "1.0.0",
      source: "custom",
    };
    const md = serializeSkillMarkdown(skill);
    const parsed = parseSkillMarkdown(md);
    expect(parsed.description).toBe("含 : 冒号");
    expect(parsed.tags).toEqual(["含:冒号", "含-横线"]);
  });
});

describe("skillDirName", () => {
  it("生成安全目录名", () => {
    expect(skillDirName("my_skill-1")).toBe("my_skill-1");
  });

  it("非法字符被替换", () => {
    expect(skillDirName("a/b\\c:d")).toBe("a_b_c_d");
  });

  it("空值回退", () => {
    expect(skillDirName("!!!")).toBe("skill");
  });
});

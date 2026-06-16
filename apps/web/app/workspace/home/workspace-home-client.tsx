"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, FormEvent, MouseEvent, ReactNode } from "react";
import {
  Activity,
  BadgePlus,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Coins,
  Copy,
  Download,
  GalleryHorizontal,
  Home,
  ImagePlus,
  LayoutTemplate,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  Square,
  Trash2,
  Upload,
  Users,
  WalletCards,
  X
} from "lucide-react";
import type {
  AdminGenerationTaskSummary,
  AdminOverviewSummary,
  AdminPointGrantResponse,
  AdminUserSummary,
  AuthUser,
  CreateGenerationTaskResponse,
  GenerationPromptPlanResponse,
  GenerationStatus,
  GenerationTaskSummary,
  InviteCodeSummary,
  PointBalanceSummary,
  PointTransactionSummary,
  ResultAssetSummary,
  TemplateSummary
} from "@ai-image/shared";
import { apiRequest, getApiBaseUrl } from "../../../lib/api";

type WorkspaceView =
  | "home"
  | "create"
  | "templates"
  | "gallery"
  | "points"
  | "admin-users"
  | "admin-tasks"
  | "admin-templates"
  | "admin-invites"
  | "settings";
type Resolution = "1k" | "2k" | "4k";
type AspectRatio =
  | "auto"
  | "1:1"
  | "3:2"
  | "2:3"
  | "4:3"
  | "3:4"
  | "5:4"
  | "4:5"
  | "16:9"
  | "9:16"
  | "2:1"
  | "1:2"
  | "3:1"
  | "1:3"
  | "21:9"
  | "9:21";
type GenerationPreset = "custom" | "ecommerce_suite" | "ecommerce_main" | "ecommerce_scene";
type SuitePlanningMode = "manual" | "auto";
type TemplateCategory = "all" | "suite" | "main" | "scene" | "detail" | "promotion";
type ReferenceImage = {
  fileName: string;
  dataUri: string;
};
type ImagePreview = {
  downloadUrl: string;
  imageUrl: string;
  prompt: string;
  title: string;
};
type ShowcaseTemplate = Pick<TemplateSummary, "id" | "title" | "description" | "defaultParams">;
type HeroSparkle = {
  id: number;
  x: number;
  y: number;
  size: number;
  rotation: number;
};

const resolutions: Resolution[] = ["1k", "2k", "4k"];
const aspectRatios: Array<{ label: string; value: AspectRatio }> = [
  { label: "Auto", value: "auto" },
  { label: "1:1", value: "1:1" },
  { label: "3:2", value: "3:2" },
  { label: "2:3", value: "2:3" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
  { label: "5:4", value: "5:4" },
  { label: "4:5", value: "4:5" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "2:1", value: "2:1" },
  { label: "1:2", value: "1:2" },
  { label: "3:1", value: "3:1" },
  { label: "1:3", value: "1:3" },
  { label: "21:9", value: "21:9" },
  { label: "9:21", value: "9:21" }
];
const taskStatuses: Array<GenerationStatus | "all"> = ["all", "queued", "processing", "succeeded", "refunded", "failed"];
const templateCategories: Array<{ id: TemplateCategory; label: string }> = [
  { id: "all", label: "全部" },
  { id: "suite", label: "商品套图" },
  { id: "main", label: "平台主图" },
  { id: "scene", label: "场景图" },
  { id: "detail", label: "细节图" },
  { id: "promotion", label: "活动图" }
];
const heroTitleWords = ["电商视觉", "产品主图", "产品宣发图", "使用场景图"];
const homeModeCardImageGroups = [
  ["/mode-cards/sayhadow-mode-01.jpg", "/mode-cards/sayhadow-mode-02.jpg", "/mode-cards/sayhadow-mode-03.jpg"],
  ["/mode-cards/sayhadow-mode-04.jpg", "/mode-cards/sayhadow-mode-05.jpg", "/mode-cards/sayhadow-mode-06.jpg"],
  ["/mode-cards/sayhadow-mode-07.jpg", "/mode-cards/sayhadow-mode-08.jpg", "/mode-cards/sayhadow-mode-09.jpg"],
  ["/mode-cards/sayhadow-mode-10.jpg", "/mode-cards/sayhadow-mode-11.jpg", "/mode-cards/sayhadow-mode-12.jpg"]
];
const generationModeCardConfigs: Array<{
  defaultCount: number;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  imageUrls: string[];
  preset: GenerationPreset;
  title: string;
}> = [
  {
    defaultCount: 3,
    description: "生成主图、细节、场景和卖点图，适合完整商品套图。",
    icon: Sparkles,
    imageUrls: homeModeCardImageGroups[0],
    preset: "ecommerce_suite",
    title: "电商套图"
  },
  {
    defaultCount: 3,
    description: "选择统一视觉风格，批量生成不同画面的商品主图。",
    icon: GalleryHorizontal,
    imageUrls: homeModeCardImageGroups[1],
    preset: "ecommerce_main",
    title: "电商主图"
  },
  {
    defaultCount: 3,
    description: "保持商品一致，生成不同使用环境和场景图。",
    icon: LayoutTemplate,
    imageUrls: homeModeCardImageGroups[2],
    preset: "ecommerce_scene",
    title: "电商场景图"
  },
  {
    defaultCount: 1,
    description: "自由输入 Prompt，适合临时创作、改图和单张测试。",
    icon: ImagePlus,
    imageUrls: homeModeCardImageGroups[3],
    preset: "custom",
    title: "产品宣发"
  }
];
const fallbackTemplatePreviewUrl =
  "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80";
const ecommerceMainStyles = [
  { id: "premium_minimal", label: "高级极简", description: "干净留白与柔和商业光" },
  { id: "luxury_display", label: "轻奢陈列", description: "精品展台与层次质感" },
  { id: "fresh_bright", label: "清新明亮", description: "明快色彩与轻盈背景" },
  { id: "high_contrast", label: "高对比质感", description: "深浅对照与视觉冲击" },
  { id: "future_tech", label: "科技未来", description: "现代光线与克制科技感" },
  { id: "soft_home", label: "柔和家居", description: "自然柔光与舒适氛围" },
  { id: "japanese_simple", label: "日系简约", description: "低饱和配色与整洁构图" },
  { id: "cream_healing", label: "奶油治愈", description: "柔软色调与温和质感" },
  { id: "natural_wood", label: "自然木质", description: "木纹空间与自然材质" },
  { id: "black_gold", label: "黑金奢华", description: "深色背景与金色点缀" },
  { id: "premium_gray", label: "高级灰", description: "中性灰阶与稳重视觉" },
  { id: "white_studio", label: "纯白棚拍", description: "标准电商棚拍与清晰主体" },
  { id: "brand_poster", label: "品牌海报", description: "广告构图与标题留白" },
  { id: "high_click", label: "平台高点击", description: "明亮直接与重点突出" },
  { id: "social_seeding", label: "社媒种草", description: "生活方式与内容感构图" },
  { id: "youth_trend", label: "年轻潮流", description: "活力配色与时尚表达" },
  { id: "oriental_elegance", label: "国风雅致", description: "东方审美与克制陈设" },
  { id: "outdoor_energy", label: "户外活力", description: "自然环境与明快动感" },
  { id: "festival_promotion", label: "节日促销", description: "节庆氛围与转化导向" },
  { id: "creative_visual", label: "创意视觉", description: "记忆点构图与商业表达" }
] as const;
type EcommerceMainStyleId = (typeof ecommerceMainStyles)[number]["id"];
const defaultEcommerceMainStyleId: EcommerceMainStyleId = "premium_minimal";

export function WorkspaceHomeClient() {
  const [activeView, setActiveView] = useState<WorkspaceView>("home");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [generationNavOpen, setGenerationNavOpen] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [balance, setBalance] = useState<PointBalanceSummary | null>(null);
  const [transactions, setTransactions] = useState<PointTransactionSummary[]>([]);
  const [tasks, setTasks] = useState<GenerationTaskSummary[]>([]);
  const [assets, setAssets] = useState<ResultAssetSummary[]>([]);
  const [templates, setTemplates] = useState<TemplateSummary[]>([]);
  const [adminTemplates, setAdminTemplates] = useState<TemplateSummary[]>([]);
  const [adminOverview, setAdminOverview] = useState<AdminOverviewSummary | null>(null);
  const [adminTasks, setAdminTasks] = useState<AdminGenerationTaskSummary[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUserSummary[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeSummary[]>([]);
  const [promptText, setPromptText] = useState("");
  const [productName, setProductName] = useState("");
  const [generationPreset, setGenerationPreset] = useState<GenerationPreset>("custom");
  const [suitePlanningMode, setSuitePlanningMode] = useState<SuitePlanningMode>("manual");
  const [suiteImagePrompts, setSuiteImagePrompts] = useState<string[]>([]);
  const [suitePlanMessage, setSuitePlanMessage] = useState("");
  const [isPlanningSuite, setIsPlanningSuite] = useState(false);
  const [selectedMainStyleId, setSelectedMainStyleId] = useState<EcommerceMainStyleId>(defaultEcommerceMainStyleId);
  const [selectedResolution, setSelectedResolution] = useState<Resolution>("1k");
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<AspectRatio>("1:1");
  const [imageCount, setImageCount] = useState(1);
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [appliedTemplateId, setAppliedTemplateId] = useState<string | null>(null);
  const [galleryQuery, setGalleryQuery] = useState("");
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const [adminTaskQuery, setAdminTaskQuery] = useState("");
  const [adminTaskStatus, setAdminTaskStatus] = useState<GenerationStatus | "all">("all");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittingUserId, setSubmittingUserId] = useState<string | null>(null);

  const isAdmin = user?.role === "admin";
  const pointCost = getResolutionPointCost(selectedResolution) * imageCount;
  const latestTasks = tasks.slice(0, 5);
  const resultTasks = tasks.filter((task) => task.assets.length > 0).slice(0, 6);

  const filteredAssets = useMemo(() => {
    const query = galleryQuery.trim().toLowerCase();
    return query ? assets.filter((asset) => asset.prompt.toLowerCase().includes(query)) : assets;
  }, [assets, galleryQuery]);

  const filteredAdminTasks = useMemo(() => {
    const query = adminTaskQuery.trim().toLowerCase();

    return adminTasks.filter((task) => {
      const statusMatches = adminTaskStatus === "all" || task.status === adminTaskStatus;
      const queryMatches = !query || task.prompt.toLowerCase().includes(query) || task.userEmail.toLowerCase().includes(query);
      return statusMatches && queryMatches;
    });
  }, [adminTaskQuery, adminTaskStatus, adminTasks]);

  async function loadWorkspace(options?: { includeAdmin?: boolean; quiet?: boolean }) {
    if (options?.quiet) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const currentUser = await apiRequest<AuthUser>("/api/auth/me");

      if (currentUser.agreementStatus !== "accepted") {
        window.location.href = "/agreement";
        return;
      }

      const [currentBalance, currentTransactions, currentTasks, currentAssets, currentTemplates] = await Promise.all([
        apiRequest<PointBalanceSummary>("/api/points/balance"),
        apiRequest<PointTransactionSummary[]>("/api/points/transactions"),
        apiRequest<GenerationTaskSummary[]>("/api/generation-tasks"),
        apiRequest<ResultAssetSummary[]>("/api/assets/results"),
        apiRequest<TemplateSummary[]>("/api/templates")
      ]);

      setUser(currentUser);
      setBalance(currentBalance);
      setTransactions(currentTransactions);
      setTasks(currentTasks);
      setAssets(currentAssets);
      setTemplates(currentTemplates);
      setError(null);

      if (currentUser.role === "admin" && options?.includeAdmin) {
        await loadAdminData();
      }
    } catch {
      setError("请先登录");
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  async function loadAdminData() {
    const [overview, adminTaskRows, userRows, invites, templateRows] = await Promise.all([
      apiRequest<AdminOverviewSummary>("/api/admin/overview"),
      apiRequest<AdminGenerationTaskSummary[]>("/api/admin/tasks"),
      apiRequest<AdminUserSummary[]>("/api/admin/users"),
      apiRequest<InviteCodeSummary[]>("/api/admin/invite-codes"),
      apiRequest<TemplateSummary[]>("/api/admin/templates")
    ]);

    setAdminOverview(overview);
    setAdminTasks(adminTaskRows);
    setAdminUsers(userRows);
    setInviteCodes(invites);
    setAdminTemplates(templateRows);
  }

  useEffect(() => {
    void loadWorkspace({ includeAdmin: true });
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [activeView]);

  useEffect(() => {
    if (!tasks.some((task) => task.status === "queued" || task.status === "processing")) {
      return;
    }

    const timer = window.setInterval(() => {
      void loadWorkspace({ quiet: true });
    }, 5000);

    return () => window.clearInterval(timer);
  }, [tasks]);

  useEffect(() => {
    if (generationPreset !== "ecommerce_suite") {
      setSuiteImagePrompts([]);
      setSuitePlanMessage("");
      return;
    }

    const timer = window.setTimeout(() => {
      void planEcommerceSuite();
    }, 150);

    return () => window.clearTimeout(timer);
  }, [generationPreset, imageCount, suitePlanningMode, productName, referenceImages]);

  async function planEcommerceSuite() {
    if (generationPreset !== "ecommerce_suite") {
      return;
    }

    setIsPlanningSuite(true);
    setSuitePlanMessage("");

    try {
      const plan = await apiRequest<GenerationPromptPlanResponse>("/api/generation-tasks/plan", {
        method: "POST",
        body: JSON.stringify({
          mode: suitePlanningMode,
          params: {
            preset: "ecommerce_suite",
            imageCount,
            productName,
            extraPrompt: promptText,
            referenceFileNames: referenceImages.map((image) => image.fileName),
            image_urls: suitePlanningMode === "auto" && referenceImages.length > 0 ? referenceImages.map((image) => image.dataUri) : undefined
          }
        })
      });

      setSuiteImagePrompts(plan.imagePrompts);
      setSuitePlanMessage(
        plan.source === "auto_placeholder"
          ? "自动模式卡片已生成。当前暂用内置模板，后续可直接接入多模态产品分析。"
          : "手动模式卡片已根据内置模板生成，可逐条编辑。"
      );
    } catch (caughtError) {
      setSuiteImagePrompts([]);
      setSuitePlanMessage(caughtError instanceof Error ? caughtError.message : "套图 Prompt 生成失败");
    } finally {
      setIsPlanningSuite(false);
    }
  }

  function updateSuiteImagePrompt(index: number, prompt: string) {
    setSuiteImagePrompts((currentPrompts) =>
      currentPrompts.map((currentPrompt, promptIndex) => (promptIndex === index ? prompt : currentPrompt))
    );
  }

  async function createTask(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setMessage(null);
    setIsSubmitting(true);

    try {
      const result = await apiRequest<CreateGenerationTaskResponse>("/api/generation-tasks", {
        method: "POST",
        body: JSON.stringify({
          templateId: appliedTemplateId || undefined,
          prompt: promptText,
          params: {
            preset: generationPreset,
            mainStyleId: generationPreset === "ecommerce_main" ? selectedMainStyleId : undefined,
            productName,
            extraPrompt: promptText,
            resolution: selectedResolution,
            imageCount,
            aspectRatio: selectedAspectRatio,
            suitePlanningMode: generationPreset === "ecommerce_suite" ? suitePlanningMode : undefined,
            imagePrompts: generationPreset === "ecommerce_suite" ? suiteImagePrompts : undefined,
            referenceFileNames: referenceImages.map((image) => image.fileName),
            image_urls: referenceImages.length > 0 ? referenceImages.map((image) => image.dataUri) : undefined
          }
        })
      });

      setTasks((currentTasks) => [result.task, ...currentTasks]);
      setPromptText("");
      setProductName("");
      setGenerationPreset("custom");
      setSuitePlanningMode("manual");
      setSuiteImagePrompts([]);
      setSuitePlanMessage("");
      setSelectedMainStyleId(defaultEcommerceMainStyleId);
      setReferenceImages([]);
      setAppliedTemplateId(null);
      setImageCount(1);
      setSelectedResolution("1k");
      setSelectedAspectRatio("1:1");
      setMessage("任务已入队，系统会自动刷新状态。");
      await loadWorkspace({ quiet: true });
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "任务创建失败");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addReferenceImages(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const selectedFiles = Array.from(files).slice(0, 10);
    const nextImages = await Promise.all(
      selectedFiles.map(async (file) => ({
        fileName: file.name,
        dataUri: await readFileAsDataUri(file)
      }))
    );

    setReferenceImages((currentImages) => [...currentImages, ...nextImages].slice(0, 10));
  }

  async function replaceReferenceImage(index: number, file: File | undefined) {
    if (!file) {
      return;
    }

    const replacement = {
      fileName: file.name,
      dataUri: await readFileAsDataUri(file)
    };

    setReferenceImages((currentImages) =>
      currentImages.map((image, imageIndex) => (imageIndex === index ? replacement : image))
    );
  }

  function removeReferenceImage(index: number) {
    setReferenceImages((currentImages) => currentImages.filter((_, imageIndex) => imageIndex !== index));
  }

  function refillFromTask(task: GenerationTaskSummary) {
    setPromptText(task.prompt);
    setProductName(readProductName(task.params));
    setGenerationPreset(readGenerationPreset(task.params));
    setSuitePlanningMode(readSuitePlanningMode(task.params));
    setSuiteImagePrompts(readSuiteImagePrompts(task.params));
    setSelectedMainStyleId(readEcommerceMainStyleId(task.params));
    setSelectedResolution(readResolution(task.params));
    setSelectedAspectRatio(readAspectRatio(task.params));
    setImageCount(readImageCount(task.params));
    setAppliedTemplateId(task.templateId);
    setActiveView("create");
    setMessage("已填入历史 Prompt，可按需要修改后重新生成。");
  }

  function clearAppliedTemplate() {
    setAppliedTemplateId(null);
  }

  function changeGenerationPreset(preset: GenerationPreset) {
    setAppliedTemplateId(null);
    setGenerationPreset(preset);
  }

  function useTemplate(template: TemplateSummary) {
    const recipe = readTemplateRecipe(template);

    setAppliedTemplateId(template.id);
    setGenerationPreset(recipe.preset);
    setImageCount(recipe.imageCount);
    setSelectedResolution(recipe.resolution);
    setSelectedAspectRatio(recipe.aspectRatio);
    setSelectedMainStyleId(recipe.mainStyleId);
    setPromptText(recipe.extraPrompt);
    setProductName("");
    setSuitePlanningMode("manual");
    setActiveView("create");
    setMessage(`已应用模板「${template.title}」，上传参考图后即可继续调整。`);
  }

  async function copyPrompt(prompt: string) {
    await navigator.clipboard.writeText(prompt);
    setMessage("Prompt 已复制。");
  }

  async function grantPoints(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setMessage(null);
    setSubmittingUserId(userId);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await apiRequest<AdminPointGrantResponse>(`/api/admin/users/${userId}/points`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(formData.get("amount")),
          reason: formData.get("reason") || undefined
        })
      });

      setAdminUsers((currentUsers) => currentUsers.map((adminUser) => (adminUser.id === result.user.id ? result.user : adminUser)));
      form.reset();
      setMessage(`已为 ${result.user.email} 充值 ${result.transaction.amount} 点。`);
      await loadWorkspace({ quiet: true });
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "充值失败");
    } finally {
      setSubmittingUserId(null);
    }
  }

  async function deductPoints(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setMessage(null);
    setSubmittingUserId(userId);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      const result = await apiRequest<AdminPointGrantResponse>(`/api/admin/users/${userId}/points/deduct`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(formData.get("amount")),
          reason: formData.get("reason") || undefined
        })
      });

      setAdminUsers((currentUsers) => currentUsers.map((adminUser) => (adminUser.id === result.user.id ? result.user : adminUser)));
      form.reset();
      setMessage(`已从 ${result.user.email} 扣除 ${Math.abs(result.transaction.amount)} 点。`);
      await loadWorkspace({ quiet: true });
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "扣除积分失败");
    } finally {
      setSubmittingUserId(null);
    }
  }

  async function deleteAdminUser(userId: string, email: string) {
    if (!window.confirm(`确定要删除用户 ${email} 吗？此操作会删除该用户的登录、任务和点数记录。`)) {
      return;
    }

    setMessage(null);
    setSubmittingUserId(userId);

    try {
      await apiRequest(`/api/admin/users/${userId}`, {
        method: "DELETE"
      });

      setAdminUsers((currentUsers) => currentUsers.filter((adminUser) => adminUser.id !== userId));
      setMessage(`已删除用户 ${email}。`);
      await loadWorkspace({ quiet: true });
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "删除用户失败");
    } finally {
      setSubmittingUserId(null);
    }
  }

  async function createInviteCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      await apiRequest<InviteCodeSummary>("/api/admin/invite-codes", {
        method: "POST",
        body: JSON.stringify({
          code: formData.get("code") || undefined,
          maxUses: Number(formData.get("maxUses") || 1),
          note: formData.get("note") || undefined
        })
      });
      form.reset();
      setInviteCodes(await apiRequest<InviteCodeSummary[]>("/api/admin/invite-codes"));
      setMessage("邀请码已创建。");
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "创建邀请码失败");
    }
  }

  async function saveTemplate(event: FormEvent<HTMLFormElement>, templateId: string | null) {
    event.preventDefault();
    setMessage(null);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const tags = String(formData.get("tags") ?? "")
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    const payload = {
      title: formData.get("title"),
      description: formData.get("description") || null,
      prompt: formData.get("prompt"),
      negativePrompt: formData.get("negativePrompt") || null,
      isPublished: formData.get("isPublished") === "on",
      defaultParams: {
        category: formData.get("category"),
        preset: formData.get("preset"),
        mainStyleId: formData.get("mainStyleId"),
        imageCount: Number(formData.get("imageCount") || 3),
        resolution: formData.get("resolution"),
        aspectRatio: formData.get("aspectRatio"),
        extraPrompt: formData.get("extraPrompt") || "",
        previewUrl: formData.get("previewUrl") || "",
        tags
      }
    };

    try {
      const savedTemplate = await apiRequest<TemplateSummary>(
        templateId ? `/api/admin/templates/${templateId}` : "/api/admin/templates",
        {
          method: "POST",
          body: JSON.stringify(payload)
        }
      );

      setAdminTemplates((currentTemplates) =>
        templateId
          ? currentTemplates.map((template) => (template.id === savedTemplate.id ? savedTemplate : template))
          : [savedTemplate, ...currentTemplates]
      );
      setTemplates(await apiRequest<TemplateSummary[]>("/api/templates"));
      setEditingTemplateId(savedTemplate.id);
      setMessage(`模板「${savedTemplate.title}」已保存。`);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "模板保存失败");
    }
  }

  async function toggleTemplatePublished(template: TemplateSummary) {
    setMessage(null);

    try {
      const updatedTemplate = await apiRequest<TemplateSummary>(`/api/admin/templates/${template.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ isPublished: !template.isPublished })
      });

      setAdminTemplates((currentTemplates) =>
        currentTemplates.map((currentTemplate) => (currentTemplate.id === updatedTemplate.id ? updatedTemplate : currentTemplate))
      );
      setTemplates(await apiRequest<TemplateSummary[]>("/api/templates"));
      setMessage(`模板「${updatedTemplate.title}」已${updatedTemplate.isPublished ? "上架" : "下架"}。`);
    } catch (caughtError) {
      setMessage(caughtError instanceof Error ? caughtError.message : "模板状态更新失败");
    }
  }

  async function logout() {
    await apiRequest<{ ok: boolean }>("/api/auth/logout", {
      method: "POST",
      body: JSON.stringify({})
    });
    window.location.href = "/login";
  }

  function selectGenerationMode(preset: GenerationPreset) {
    setGenerationPreset(preset);
    setImageCount(preset === "custom" ? 1 : 3);
    setGenerationNavOpen(true);
    setActiveView("create");
  }

  function toggleGenerationNav() {
    setActiveView("create");
    setGenerationNavOpen((current) => (activeView === "create" ? !current : true));
  }

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <section className="rounded-lg border border-white/10 bg-white/10 p-6 text-center shadow-sm">
          <p className="text-sm text-slate-200">{error}</p>
          <a className="mt-4 inline-flex h-10 items-center rounded-md bg-white px-4 text-sm font-semibold text-slate-950" href="/login">
            去登录
          </a>
        </section>
      </main>
    );
  }

  if (isLoading || !user || !balance) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-white">
        <section className="rounded-lg border border-white/10 bg-white/10 p-6 text-center shadow-sm">
          <Loader2 className="mx-auto h-5 w-5 animate-spin" aria-hidden={true} />
          <p className="mt-3 text-sm text-slate-200">正在加载工作台</p>
        </section>
      </main>
    );
  }

  return (
    <main className="sayhadow-workspace flex min-h-screen bg-slate-100 text-slate-950">
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col bg-slate-950 text-white transition-all ${
          sidebarCollapsed ? "w-[76px]" : "w-[272px]"
        }`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          <button className="inline-flex items-center gap-3" type="button" onClick={() => setActiveView("home")}>
            <span className="sayhadow-logo-mark grid h-9 w-9 place-items-center rounded-xl text-sm font-black text-white">S</span>
            {!sidebarCollapsed ? <span className="text-lg font-semibold">Sayhadow</span> : null}
          </button>
          <button
            className="grid h-9 w-9 place-items-center rounded-md text-slate-300 transition hover:bg-white/10"
            aria-label={sidebarCollapsed ? "展开导航" : "收起导航"}
            type="button"
            onClick={() => setSidebarCollapsed((current) => !current)}
          >
            {sidebarCollapsed ? <ChevronRight className="h-4 w-4" aria-hidden={true} /> : <ChevronLeft className="h-4 w-4" aria-hidden={true} />}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          <SidebarItem active={activeView === "home"} collapsed={sidebarCollapsed} icon={Home} label="首页" onClick={() => setActiveView("home")} />
          <SidebarItem active={activeView === "create"} collapsed={sidebarCollapsed} icon={ImagePlus} label="图片生成" onClick={toggleGenerationNav} />
          {generationNavOpen ? (
            <div className={`${sidebarCollapsed ? "mt-1 grid justify-items-center gap-1" : "mt-1 space-y-1 pl-5"}`}>
              <SidebarSubItem active={activeView === "create" && generationPreset === "ecommerce_suite"} collapsed={sidebarCollapsed} label="电商套图" onClick={() => selectGenerationMode("ecommerce_suite")} />
              <SidebarSubItem active={activeView === "create" && generationPreset === "ecommerce_main"} collapsed={sidebarCollapsed} label="电商主图" onClick={() => selectGenerationMode("ecommerce_main")} />
              <SidebarSubItem active={activeView === "create" && generationPreset === "ecommerce_scene"} collapsed={sidebarCollapsed} label="电商场景图" onClick={() => selectGenerationMode("ecommerce_scene")} />
              <SidebarSubItem active={activeView === "create" && generationPreset === "custom"} collapsed={sidebarCollapsed} label="产品宣发" onClick={() => selectGenerationMode("custom")} />
            </div>
          ) : null}
          <SidebarItem active={activeView === "templates"} collapsed={sidebarCollapsed} icon={LayoutTemplate} label="模板广场" onClick={() => setActiveView("templates")} />
          <SidebarItem active={activeView === "gallery"} collapsed={sidebarCollapsed} icon={GalleryHorizontal} label="结果图库" onClick={() => setActiveView("gallery")} />
          <SidebarItem active={activeView === "points"} collapsed={sidebarCollapsed} icon={WalletCards} label="点数流水" onClick={() => setActiveView("points")} />

          {isAdmin ? (
            <div className="mt-6 pt-2">
              {!sidebarCollapsed ? <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Admin</div> : null}
              <SidebarItem active={activeView === "admin-users"} collapsed={sidebarCollapsed} icon={Users} label="用户充值" onClick={() => setActiveView("admin-users")} />
              <SidebarItem active={activeView === "admin-tasks"} collapsed={sidebarCollapsed} icon={Activity} label="任务日志" onClick={() => setActiveView("admin-tasks")} />
              <SidebarItem active={activeView === "admin-templates"} collapsed={sidebarCollapsed} icon={LayoutTemplate} label="模板管理" onClick={() => setActiveView("admin-templates")} />
              <SidebarItem active={activeView === "admin-invites"} collapsed={sidebarCollapsed} icon={BadgePlus} label="邀请码" onClick={() => setActiveView("admin-invites")} />
            </div>
          ) : null}
        </nav>

        <div className="space-y-3 p-3">
          {!sidebarCollapsed ? (
            <section className="rounded-2xl bg-white/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white">分享得积分</div>
                  <p className="mt-1 text-xs text-slate-400">邀请好友领 200 积分</p>
                </div>
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10">
                  <Sparkles className="h-4 w-4" aria-hidden={true} />
                </div>
              </div>
            </section>
          ) : null}
          <button
            className={`flex w-full items-center gap-3 rounded-2xl bg-white/5 p-3 text-left ${sidebarCollapsed ? "justify-center" : ""}`}
            aria-label="用户与设置"
            type="button"
            onClick={() => setActiveView("settings")}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-sm font-semibold text-slate-950">
              {(user.displayName || user.email).slice(0, 1).toUpperCase()}
            </span>
            {!sidebarCollapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{user.displayName || user.email}</span>
                <span className="mt-0.5 block text-xs text-slate-400">可用 {balance.available} 点 · 预扣 {balance.held} 点</span>
              </span>
            ) : null}
          </button>
          <div className={`grid gap-2 ${sidebarCollapsed ? "" : "grid-cols-2"}`}>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              aria-label="设置"
              type="button"
              onClick={() => setActiveView("settings")}
            >
              <Settings className="h-4 w-4" aria-hidden={true} />
              {!sidebarCollapsed ? "设置" : null}
            </button>
            <button
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md text-sm font-semibold text-slate-200 transition hover:bg-white/10"
              aria-label="退出"
              type="button"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" aria-hidden={true} />
              {!sidebarCollapsed ? "退出" : null}
            </button>
          </div>
        </div>
      </aside>

      <section className="min-w-0 flex-1">
        <div className="px-6 py-6">
          {activeView === "home" ? (
            <HomeView
              balance={balance}
              createTask={createTask}
              imageCount={imageCount}
              isSubmitting={isSubmitting}
              latestTasks={latestTasks}
              pointCost={pointCost}
              promptText={promptText}
              productName={productName}
              referenceImages={referenceImages}
              resultTasks={resultTasks}
              selectedAspectRatio={selectedAspectRatio}
              selectedResolution={selectedResolution}
              templates={templates}
              addReferenceImages={addReferenceImages}
              removeReferenceImage={removeReferenceImage}
              setActiveView={setActiveView}
              setGenerationPreset={changeGenerationPreset}
              setImageCount={setImageCount}
              setProductName={setProductName}
              setPromptText={setPromptText}
              setSelectedAspectRatio={setSelectedAspectRatio}
              setSelectedResolution={setSelectedResolution}
              useTemplate={useTemplate}
              refillFromTask={refillFromTask}
              openImagePreview={setImagePreview}
            />
          ) : null}
          {activeView === "create" ? (
            <CreateView
              imageCount={imageCount}
              appliedTemplate={templates.find((template) => template.id === appliedTemplateId) ?? null}
              generationPreset={generationPreset}
              isSubmitting={isSubmitting}
              message={message}
              pointCost={pointCost}
              promptText={promptText}
              productName={productName}
              referenceImages={referenceImages}
              recentAssets={assets.slice(0, 8)}
              recentTasks={tasks.slice(0, 8)}
              selectedAspectRatio={selectedAspectRatio}
              selectedResolution={selectedResolution}
              selectedMainStyleId={selectedMainStyleId}
              suitePlanningMode={suitePlanningMode}
              suiteImagePrompts={suiteImagePrompts}
              suitePlanMessage={suitePlanMessage}
              isPlanningSuite={isPlanningSuite}
              setImageCount={setImageCount}
              setGenerationPreset={changeGenerationPreset}
              clearAppliedTemplate={clearAppliedTemplate}
              setSelectedMainStyleId={setSelectedMainStyleId}
              setSuitePlanningMode={setSuitePlanningMode}
              setPromptText={setPromptText}
              setProductName={setProductName}
              setSelectedAspectRatio={setSelectedAspectRatio}
              setSelectedResolution={setSelectedResolution}
              updateSuiteImagePrompt={updateSuiteImagePrompt}
              planEcommerceSuite={planEcommerceSuite}
              copyPrompt={copyPrompt}
              createTask={createTask}
              addReferenceImages={addReferenceImages}
              removeReferenceImage={removeReferenceImage}
              replaceReferenceImage={replaceReferenceImage}
              refillFromTask={refillFromTask}
              openImagePreview={setImagePreview}
            />
          ) : null}
          {activeView === "templates" ? <TemplatesMarketplace templates={templates} useTemplate={useTemplate} /> : null}
          {activeView === "gallery" ? (
            <GalleryView assets={filteredAssets} query={galleryQuery} setQuery={setGalleryQuery} copyPrompt={copyPrompt} openImagePreview={setImagePreview} />
          ) : null}
          {activeView === "points" ? <PointsView balance={balance} transactions={transactions} /> : null}
          {activeView === "admin-users" && isAdmin ? (
            <AdminUsersView
              users={adminUsers}
              submittingUserId={submittingUserId}
              grantPoints={grantPoints}
              deductPoints={deductPoints}
              deleteUser={deleteAdminUser}
            />
          ) : null}
          {activeView === "admin-tasks" && isAdmin ? (
            <AdminTasksView
              overview={adminOverview}
              tasks={filteredAdminTasks}
              query={adminTaskQuery}
              selectedStatus={adminTaskStatus}
              setQuery={setAdminTaskQuery}
              setSelectedStatus={setAdminTaskStatus}
            />
          ) : null}
          {activeView === "admin-templates" && isAdmin ? (
            <AdminTemplatesView
              editingTemplate={adminTemplates.find((template) => template.id === editingTemplateId) ?? null}
              templates={adminTemplates}
              saveTemplate={saveTemplate}
              setEditingTemplateId={setEditingTemplateId}
              toggleTemplatePublished={toggleTemplatePublished}
            />
          ) : null}
          {activeView === "admin-invites" && isAdmin ? <InviteCodesView inviteCodes={inviteCodes} createInviteCode={createInviteCode} /> : null}
          {activeView === "settings" ? <SettingsView user={user} balance={balance} /> : null}
        </div>
      </section>
      {imagePreview ? <ImagePreviewModal preview={imagePreview} onClose={() => setImagePreview(null)} /> : null}
    </main>
  );
}

function ImagePreviewModal({ preview, onClose }: { preview: ImagePreview; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/78 p-4 backdrop-blur-md" role="dialog" aria-modal={true}>
      <button className="absolute inset-0 cursor-default" aria-label="关闭预览" type="button" onClick={onClose} />
      <section className="relative flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#09090b] text-white shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{preview.title}</h2>
            <p className="mt-1 line-clamp-1 text-xs text-slate-400">{preview.prompt}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <a className="inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-semibold text-slate-950 hover:bg-slate-200" download={true} href={preview.downloadUrl}>
              <Download className="h-4 w-4" aria-hidden={true} />
              下载
            </a>
            <button className="grid h-9 w-9 place-items-center rounded-md border border-white/10 text-slate-200 hover:bg-white/10" type="button" aria-label="关闭预览" onClick={onClose}>
              <X className="h-4 w-4" aria-hidden={true} />
            </button>
          </div>
        </div>
        <div className="grid min-h-0 flex-1 place-items-center overflow-auto bg-black p-4">
          <img alt={preview.prompt} className="max-h-[78vh] max-w-full rounded-lg object-contain" src={preview.imageUrl} />
        </div>
      </section>
    </div>
  );
}

function HomeView({
  balance,
  createTask,
  imageCount,
  isSubmitting,
  latestTasks,
  pointCost,
  promptText,
  productName,
  referenceImages,
  resultTasks,
  selectedAspectRatio,
  selectedResolution,
  templates,
  addReferenceImages,
  removeReferenceImage,
  setActiveView,
  setGenerationPreset,
  setImageCount,
  setProductName,
  setPromptText,
  setSelectedAspectRatio,
  setSelectedResolution,
  useTemplate,
  refillFromTask,
  openImagePreview
}: {
  balance: PointBalanceSummary;
  createTask: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  imageCount: number;
  isSubmitting: boolean;
  latestTasks: GenerationTaskSummary[];
  pointCost: number;
  promptText: string;
  productName: string;
  referenceImages: ReferenceImage[];
  resultTasks: GenerationTaskSummary[];
  selectedAspectRatio: AspectRatio;
  selectedResolution: Resolution;
  templates: TemplateSummary[];
  addReferenceImages: (files: FileList | null) => Promise<void>;
  removeReferenceImage: (index: number) => void;
  setActiveView: (view: WorkspaceView) => void;
  setGenerationPreset: (preset: GenerationPreset) => void;
  setImageCount: (count: number) => void;
  setProductName: (productName: string) => void;
  setPromptText: (prompt: string) => void;
  setSelectedAspectRatio: (aspectRatio: AspectRatio) => void;
  setSelectedResolution: (resolution: Resolution) => void;
  useTemplate: (template: TemplateSummary) => void;
  refillFromTask: (task: GenerationTaskSummary) => void;
  openImagePreview: (preview: ImagePreview) => void;
}) {
  const showcaseTemplates = templates.slice(0, 10);
  const fallbackShowcaseTemplates = getFallbackShowcaseTemplates();
  const [heroSparkles, setHeroSparkles] = useState<HeroSparkle[]>([]);
  const [heroTitleWordIndex, setHeroTitleWordIndex] = useState(0);
  const [isHomePromptFocused, setIsHomePromptFocused] = useState(false);
  const [isHomePromptOverflowing, setIsHomePromptOverflowing] = useState(false);
  const homeReferenceInputRef = useRef<HTMLInputElement | null>(null);
  const homePromptTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const heroSparkleIdRef = useRef(0);
  const lastHeroSparkleAtRef = useRef(0);
  const heroTitleWord = heroTitleWords[heroTitleWordIndex % heroTitleWords.length];
  const isHomePromptExpanded = isHomePromptFocused && isHomePromptOverflowing;

  useEffect(() => {
    const timer = window.setInterval(() => {
      setHeroTitleWordIndex((current) => (current + 1) % heroTitleWords.length);
    }, 4000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const textarea = homePromptTextareaRef.current;

    if (!textarea) {
      return;
    }

    const updatePromptExpansion = () => {
      const computedStyle = window.getComputedStyle(textarea);
      const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24;
      const twoLineHeight = lineHeight * 2;
      const shell = textarea.closest(".sayhadow-home-prompt-shell");
      const wasExpanded = shell?.classList.contains("is-expanded") ?? false;

      if (wasExpanded) {
        shell?.classList.remove("is-expanded");
      }
      setIsHomePromptOverflowing(textarea.scrollHeight > twoLineHeight + 10);
      if (wasExpanded) {
        shell?.classList.add("is-expanded");
      }
    };

    updatePromptExpansion();
    window.addEventListener("resize", updatePromptExpansion);

    return () => window.removeEventListener("resize", updatePromptExpansion);
  }, [promptText]);

  const openFallbackRecipe = (template: ShowcaseTemplate) => {
    const recipe = readTemplateRecipe(template);

    setGenerationPreset(recipe.preset);
    setImageCount(recipe.imageCount);
    setActiveView("create");
  };
  const addHeroSparkle = (event: MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;

    if (target.closest(".sayhadow-home-composer")) {
      return;
    }

    const now = performance.now();

    if (now - lastHeroSparkleAtRef.current < 42) {
      return;
    }

    lastHeroSparkleAtRef.current = now;

    const rect = event.currentTarget.getBoundingClientRect();
    const sparkle: HeroSparkle = {
      id: heroSparkleIdRef.current,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      size: 8 + Math.random() * 10,
      rotation: Math.random() * 90
    };

    heroSparkleIdRef.current += 1;
    setHeroSparkles((current) => [...current.slice(-18), sparkle]);
    window.setTimeout(() => {
      setHeroSparkles((current) => current.filter((item) => item.id !== sparkle.id));
    }, 820);
  };

  return (
    <div className="space-y-10">
      <section
        className="relative rounded-[2rem] px-5 py-12 text-center md:px-12"
        onMouseLeave={() => setHeroSparkles([])}
        onMouseMove={addHeroSparkle}
      >
        <div className="sayhadow-live-hero-glow pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-0" aria-hidden={true}>
          {heroSparkles.map((sparkle) => (
            <span
              className="sayhadow-cursor-star absolute"
              key={sparkle.id}
              style={{
                height: sparkle.size,
                left: sparkle.x,
                top: sparkle.y,
                transform: `translate(-50%, -50%) rotate(${sparkle.rotation}deg)`,
                width: sparkle.size
              }}
            />
          ))}
        </div>
        <div className="relative mx-auto max-w-6xl">
          <h1 className="pointer-events-none select-none cursor-default text-4xl font-semibold leading-tight tracking-normal md:text-5xl 2xl:text-6xl">
            用 Sayhadow 轻松做爆款
            <span className="sayhadow-hero-word text-sky-400" key={heroTitleWord}>
              {heroTitleWord}
            </span>
          </h1>
          <p className="pointer-events-none mx-auto mt-5 max-w-2xl select-none cursor-default text-base leading-7 text-slate-300">
            AI 一键生成，低成本搞定电商主图、场景图、细节图和套图视觉。
          </p>

          <form
            className="sayhadow-home-composer mx-auto mt-9 grid w-full max-w-5xl rounded-[1.75rem] border border-sky-400/40 bg-white/[0.07] p-4 text-left shadow-[0_0_80px_rgba(56,189,248,0.15)] backdrop-blur transition focus-within:border-sky-300 md:p-5"
            onSubmit={createTask}
          >
            <div className="flex min-h-20 items-start gap-4">
              <button
                className="grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/15 bg-black/25 text-slate-200 transition hover:border-sky-300/60 hover:bg-white/10"
                title="添加参考图"
                type="button"
                onClick={() => homeReferenceInputRef.current?.click()}
              >
                <ImagePlus className="h-6 w-6" aria-hidden={true} />
              </button>
              <input
                ref={homeReferenceInputRef}
                accept="image/*"
                className="hidden"
                multiple={true}
                tabIndex={-1}
                type="file"
                onChange={(event) => {
                  void addReferenceImages(event.currentTarget.files);
                  event.currentTarget.value = "";
                  event.currentTarget.blur();
                }}
              />
              <div className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/15 px-4 py-2.5 transition focus-within:border-sky-300/55 focus-within:bg-black/25">
                <input
                  className="h-8 w-full border-0 bg-transparent px-0 text-base text-white outline-none placeholder:text-slate-400"
                  maxLength={100}
                  placeholder="产品名，可不填"
                  value={productName}
                  onChange={(event) => setProductName(event.target.value)}
                />
                <div className="my-2 h-px bg-white/10" />
                <div className={`sayhadow-home-prompt-shell ${isHomePromptExpanded ? "is-expanded" : ""}`}>
                <textarea
                  ref={homePromptTextareaRef}
                  className="sayhadow-home-prompt-input w-full resize-none border-0 bg-transparent p-0 text-base leading-6 text-white outline-none placeholder:text-slate-400"
                  maxLength={2000}
                  name="prompt"
                  placeholder="描述你想要生成/修改的内容，使用左侧按钮添加参考图"
                  rows={2}
                  value={promptText}
                  onChange={(event) => setPromptText(event.target.value)}
                  onBlur={() => setIsHomePromptFocused(false)}
                  onFocus={() => setIsHomePromptFocused(true)}
                />
                </div>
              </div>
            </div>
            {referenceImages.length > 0 ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {referenceImages.slice(0, 10).map((image, index) => (
                  <div className="group relative h-14 w-14 shrink-0" key={`${image.fileName}-${index}`}>
                    <img
                      alt={`参考图 ${index + 1}`}
                      className="h-full w-full rounded-xl border border-white/10 object-cover"
                      src={image.dataUri}
                    />
                    <button
                      aria-label={`删除参考图 ${index + 1}`}
                      className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full border border-white/25 bg-black/45 text-xs font-semibold leading-none text-white/90 shadow-sm backdrop-blur transition hover:border-white/40 hover:bg-white/20 hover:text-white"
                      title="删除"
                      type="button"
                      onClick={() => removeReferenceImage(index)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
                <OpenAiLogo className="h-4 w-4" />
                gpt-image-2
              </span>
              {resolutions.map((resolution) => (
                <button
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    selectedResolution === resolution
                      ? "bg-sky-300 !text-slate-950 shadow-[0_0_24px_rgba(125,211,252,0.28)]"
                      : "bg-white/10 text-white hover:bg-white/15"
                  }`}
                  key={resolution}
                  type="button"
                  onClick={() => setSelectedResolution(resolution)}
                >
                  {resolution.toUpperCase()} 高清
                </button>
              ))}
              <div className="inline-flex max-w-full flex-wrap items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-2 text-sm font-semibold text-white">
                <span className="pl-1 text-white/75">尺寸</span>
                {aspectRatios.map((aspectRatio) => (
                  <button
                    className={`h-7 rounded-full px-2.5 text-xs font-semibold transition ${
                      selectedAspectRatio === aspectRatio.value
                        ? "bg-sky-300 text-slate-950"
                        : "bg-white/10 text-white hover:bg-white/20"
                    }`}
                    key={aspectRatio.value}
                    type="button"
                    onClick={() => setSelectedAspectRatio(aspectRatio.value)}
                  >
                    {aspectRatio.label}
                  </button>
                ))}
              </div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-2.5 py-2 text-sm font-semibold text-white">
                <span className="pl-2">生成</span>
                <button
                  aria-label="减少生成张数"
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-base leading-none text-white/80 transition hover:bg-white/20 disabled:opacity-35"
                  disabled={imageCount <= 1}
                  type="button"
                  onClick={() => setImageCount(Math.max(1, imageCount - 1))}
                >
                  -
                </button>
                <span className="min-w-7 text-center tabular-nums">{imageCount}</span>
                <button
                  aria-label="增加生成张数"
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/10 text-base leading-none text-white/80 transition hover:bg-white/20 disabled:opacity-35"
                  disabled={imageCount >= 10}
                  type="button"
                  onClick={() => setImageCount(Math.min(10, imageCount + 1))}
                >
                  +
                </button>
                <span className="pr-2">张</span>
              </div>
              <span className="rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">{pointCost} 点</span>
              <button
                className="ml-auto inline-flex min-h-11 items-center justify-center rounded-full bg-white px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={isSubmitting || !promptText.trim()}
                type="submit"
              >
                {isSubmitting ? "提交中" : "直接生成"}
              </button>
            </div>
          </form>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {generationModeCardConfigs.map((card) => (
          <HomeModeCard
            description={card.description}
            icon={card.icon}
            imageUrls={card.imageUrls}
            key={card.preset}
            title={card.title}
            onClick={() => {
              setGenerationPreset(card.preset);
              setImageCount(card.defaultCount);
              setActiveView("create");
            }}
          />
        ))}
      </section>

      <section>
        <div>
          <div className="sticky top-0 z-20 -mx-1 mb-5 flex items-center justify-between gap-3 rounded-b-2xl bg-[#050506]/82 px-1 py-3 backdrop-blur-xl">
            <h2 className="text-2xl font-semibold">模板广场</h2>
            <button className="text-sm font-semibold text-slate-300 hover:text-white" type="button" onClick={() => setActiveView("templates")}>
              查看全部
            </button>
          </div>
          <div className="grid gap-x-4 gap-y-6 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-5">
            {showcaseTemplates.length > 0
              ? showcaseTemplates
                  .slice(0, 8)
                  .map((item, index) => <ShowcaseTemplateCard index={index} key={item.id} template={item} onClick={() => useTemplate(item)} />)
              : fallbackShowcaseTemplates
                  .slice(0, 8)
                  .map((item, index) => <ShowcaseTemplateCard index={index} key={item.id} template={item} onClick={() => openFallbackRecipe(item)} />)}
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">最新结果</h2>
          <button className="text-sm font-semibold text-slate-600 hover:text-slate-950" type="button" onClick={() => setActiveView("gallery")}>
            查看全部
          </button>
        </div>
        <ResultGrid tasks={resultTasks} compact={true} openImagePreview={openImagePreview} />
      </section>
    </div>
  );
}

function ShowcaseTemplateCard({
  index = 0,
  template,
  onClick
}: {
  index?: number;
  template: ShowcaseTemplate;
  onClick: () => void;
}) {
  const recipe = readTemplateRecipe(template);
  const offsetClass = ["md:translate-y-0", "md:translate-y-3", "md:-translate-y-1", "md:translate-y-5", "md:translate-y-2"][
    index % 5
  ];

  return (
    <button
      className={`group overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.055] text-left shadow-sm transition hover:-translate-y-0.5 hover:border-white/25 ${offsetClass}`}
      type="button"
      onClick={onClick}
    >
      <div className="relative aspect-[4/5] overflow-hidden bg-black">
        <img alt={template.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" src={templatePreviewSrc(recipe.previewUrl)} />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-4">
          <div className="text-lg font-semibold text-white">{template.title}</div>
          <div className="mt-1 text-xs text-white/65">{recipe.imageCount} 张 · {formatTemplateCategory(recipe.category)}</div>
        </div>
      </div>
    </button>
  );
}

function getFallbackShowcaseTemplates(): ShowcaseTemplate[] {
  return [
    {
      id: "fallback-lighting",
      title: "产品打光增强",
      description: "适合白底和棚拍主图",
      defaultParams: {
        category: "main",
        preset: "ecommerce_main",
        imageCount: 5,
        resolution: "1k",
        previewUrl: "https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      id: "fallback-fashion",
      title: "衣服拍摄",
      description: "服饰展示与细节变化",
      defaultParams: {
        category: "suite",
        preset: "ecommerce_suite",
        imageCount: 5,
        resolution: "1k",
        previewUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      id: "fallback-scene",
      title: "提取场景",
      description: "产品场景化展示",
      defaultParams: {
        category: "scene",
        preset: "ecommerce_scene",
        imageCount: 3,
        resolution: "1k",
        previewUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=900&q=80"
      }
    },
    {
      id: "fallback-detail",
      title: "卖点细节图",
      description: "材质、结构和卖点说明",
      defaultParams: {
        category: "detail",
        preset: "ecommerce_suite",
        imageCount: 3,
        resolution: "1k",
        previewUrl: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80"
      }
    }
  ];
}

function OpenAiLogo({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden={true}
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M12.2 2.75a4.2 4.2 0 0 0-3.74 2.28 4.15 4.15 0 0 0-4.21 6.41 4.18 4.18 0 0 0 3.54 6.55 4.19 4.19 0 0 0 7.75 1 4.15 4.15 0 0 0 4.21-6.42 4.18 4.18 0 0 0-3.54-6.55 4.2 4.2 0 0 0-4.01-3.27Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.55"
      />
      <path
        d="M8.46 5.03 12 7.1l3.99-1.08M4.25 11.44l3.56-2.05.65-4.36M7.79 17.99l-.02-4.1-3.52-2.45M15.54 18.99 12 16.9l-4.21 1.09M19.75 12.57l-3.56 2.05-.65 4.37M16.21 6.02l.02 4.1 3.52 2.45M7.77 13.89 12 16.9l4.19-2.28.04-4.5L12 7.1 7.81 9.39l-.04 4.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.25"
      />
    </svg>
  );
}

function HomeModeCard({
  active = false,
  description,
  icon: Icon,
  imageUrls,
  onClick,
  title
}: {
  active?: boolean;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  imageUrls: string[];
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      className={`group relative min-h-[21rem] overflow-hidden rounded-[1.6rem] border p-3 text-left shadow-sm transition duration-300 hover:-translate-y-1 hover:border-sky-300/50 hover:bg-white/[0.08] hover:shadow-[0_22px_80px_rgba(0,0,0,0.32)] ${
        active ? "border-sky-300/55 bg-white/[0.09] shadow-[0_22px_80px_rgba(0,0,0,0.32)]" : "border-white/10 bg-white/[0.055]"
      }`}
      type="button"
      onClick={onClick}
    >
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/12 to-black/82" />
      <div className="relative grid h-48 grid-cols-[1.1fr_0.9fr] gap-2 overflow-hidden rounded-[1.25rem]">
        <img
          alt={`${title} preview 1`}
          className="h-full w-full rounded-[1.05rem] object-cover transition duration-500 group-hover:scale-105"
          src={imageUrls[0]}
        />
        <div className="grid grid-rows-2 gap-2">
          <img
            alt={`${title} preview 2`}
            className="h-full min-h-0 w-full rounded-[1.05rem] object-cover transition duration-500 group-hover:scale-105"
            src={imageUrls[1]}
          />
          <img
            alt={`${title} preview 3`}
            className="h-full min-h-0 w-full rounded-[1.05rem] object-cover transition duration-500 group-hover:scale-105"
            src={imageUrls[2]}
          />
        </div>
      </div>
      <div className="pointer-events-none absolute inset-3 rounded-[1.25rem] ring-1 ring-white/10" />
      <div className="absolute left-5 top-5 flex items-center gap-2">
        <span className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-black/35 text-white shadow-lg backdrop-blur-md transition group-hover:bg-white group-hover:text-slate-950">
          <Icon className="h-5 w-5" aria-hidden={true} />
        </span>
        <span className="hidden">进入模式</span>
      </div>
      <div className="relative mt-4 flex items-end justify-between gap-3 px-2">
        <h3 className="text-2xl font-semibold text-white">{title}</h3>
          <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-slate-200 backdrop-blur">{active ? "当前模式" : "进入模式"}</span>
      </div>
      <p className="relative mt-3 line-clamp-2 min-h-12 px-2 text-sm leading-6 text-slate-300">{description}</p>
    </button>
  );
}

function TemplatesMarketplace({
  templates,
  useTemplate
}: {
  templates: TemplateSummary[];
  useTemplate: (template: TemplateSummary) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("all");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return templates.filter((template) => {
      const recipe = readTemplateRecipe(template);
      const categoryMatches = category === "all" || recipe.category === category;
      const queryMatches =
        !normalizedQuery ||
        template.title.toLowerCase().includes(normalizedQuery) ||
        (template.description ?? "").toLowerCase().includes(normalizedQuery) ||
        recipe.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery));

      return categoryMatches && queryMatches;
    });
  }, [category, query, templates]);
  const selectedTemplate =
    filteredTemplates.find((template) => template.id === selectedTemplateId) ?? filteredTemplates[0] ?? null;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="min-w-0">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">模板广场</h2>
              <p className="mt-1 text-sm text-slate-500">选择电商生成配方，上传自己的产品图后继续调整。</p>
            </div>
            <label className="relative block w-full max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
              <input
                className="h-10 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-slate-950"
                placeholder="搜索模板、用途或品类"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {templateCategories.map((item) => (
              <button
                className={`h-9 rounded-md border px-3 text-sm font-semibold transition ${
                  category === item.id
                    ? "border-slate-950 bg-slate-950 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
                key={item.id}
                type="button"
                onClick={() => setCategory(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {filteredTemplates.map((template) => {
            const recipe = readTemplateRecipe(template);
            const active = selectedTemplate?.id === template.id;

            return (
              <article
                className={`overflow-hidden rounded-lg border bg-white shadow-sm transition ${
                  active ? "border-slate-950 ring-1 ring-slate-950" : "border-slate-200 hover:border-slate-400"
                }`}
                key={template.id}
              >
                <button className="block w-full text-left" type="button" onClick={() => setSelectedTemplateId(template.id)}>
                  <img alt={template.title} className="aspect-[4/3] w-full object-cover" loading="lazy" src={templatePreviewSrc(recipe.previewUrl)} />
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold">{template.title}</h3>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{template.description}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                        {recipe.imageCount} 张
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {recipe.tags.slice(0, 3).map((tag) => (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600" key={tag}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </button>
                <div className="border-t border-slate-100 p-3">
                  <button
                    className="h-9 w-full rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800"
                    type="button"
                    onClick={() => useTemplate(template)}
                  >
                    立即使用
                  </button>
                </div>
              </article>
            );
          })}
        </div>

        {filteredTemplates.length === 0 ? <EmptyState text="没有找到匹配模板" /> : null}
      </section>

      <aside className="h-fit rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:sticky xl:top-20">
        {selectedTemplate ? (
          <TemplateDetails template={selectedTemplate} useTemplate={useTemplate} />
        ) : (
          <EmptyState text="暂无已上架模板" />
        )}
      </aside>
    </div>
  );
}

function TemplateDetails({
  template,
  useTemplate
}: {
  template: TemplateSummary;
  useTemplate: (template: TemplateSummary) => void;
}) {
  const recipe = readTemplateRecipe(template);

  return (
    <>
      <img alt={template.title} className="aspect-[4/3] w-full rounded-md object-cover" src={templatePreviewSrc(recipe.previewUrl)} />
      <div className="mt-4 text-xs font-semibold text-sky-700">{formatTemplateCategory(recipe.category)}</div>
      <h2 className="mt-1 text-lg font-semibold">{template.title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{template.description}</p>

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <TemplateDetail label="默认生成" value={`${recipe.imageCount} 张`} />
        <TemplateDetail label="默认清晰度" value={recipe.resolution.toUpperCase()} />
        <TemplateDetail label="默认尺寸" value={getAspectRatioLabel(recipe.aspectRatio)} />
        <TemplateDetail label="生成模式" value={getPresetMeta(recipe.preset).title.replace("模式", "")} />
        <TemplateDetail label="预计消耗" value={`${getResolutionPointCost(recipe.resolution) * recipe.imageCount} 点`} />
      </dl>

      <div className="mt-5">
        <div className="text-xs font-semibold text-slate-500">适合</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {recipe.tags.map((tag) => (
            <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600" key={tag}>
              {tag}
            </span>
          ))}
        </div>
      </div>

      <button
        className="mt-5 h-11 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        type="button"
        onClick={() => useTemplate(template)}
      >
        使用这个模板
      </button>
    </>
  );
}

function TemplateDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 text-sm font-semibold">{value}</dd>
    </div>
  );
}

function CreateView({
  appliedTemplate,
  generationPreset,
  imageCount,
  isSubmitting,
  message,
  pointCost,
  promptText,
  productName,
  referenceImages,
  recentAssets,
  recentTasks,
  selectedAspectRatio,
  selectedMainStyleId,
  selectedResolution,
  suitePlanningMode,
  suiteImagePrompts,
  suitePlanMessage,
  isPlanningSuite,
  setImageCount,
  setGenerationPreset,
  clearAppliedTemplate,
  setSelectedMainStyleId,
  setSuitePlanningMode,
  setPromptText,
  setProductName,
  setSelectedAspectRatio,
  setSelectedResolution,
  updateSuiteImagePrompt,
  planEcommerceSuite,
  copyPrompt,
  createTask,
  addReferenceImages,
  removeReferenceImage,
  replaceReferenceImage,
  refillFromTask,
  openImagePreview
}: {
  appliedTemplate: TemplateSummary | null;
  generationPreset: GenerationPreset;
  imageCount: number;
  isSubmitting: boolean;
  message: string | null;
  pointCost: number;
  promptText: string;
  productName: string;
  referenceImages: ReferenceImage[];
  recentAssets: ResultAssetSummary[];
  recentTasks: GenerationTaskSummary[];
  selectedAspectRatio: AspectRatio;
  selectedMainStyleId: EcommerceMainStyleId;
  selectedResolution: Resolution;
  suitePlanningMode: SuitePlanningMode;
  suiteImagePrompts: string[];
  suitePlanMessage: string;
  isPlanningSuite: boolean;
  setImageCount: (count: number) => void;
  setGenerationPreset: (preset: GenerationPreset) => void;
  clearAppliedTemplate: () => void;
  setSelectedMainStyleId: (styleId: EcommerceMainStyleId) => void;
  setSuitePlanningMode: (mode: SuitePlanningMode) => void;
  setPromptText: (prompt: string) => void;
  setProductName: (productName: string) => void;
  setSelectedAspectRatio: (aspectRatio: AspectRatio) => void;
  setSelectedResolution: (resolution: Resolution) => void;
  updateSuiteImagePrompt: (index: number, prompt: string) => void;
  planEcommerceSuite: () => Promise<void>;
  copyPrompt: (prompt: string) => Promise<void>;
  createTask: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  addReferenceImages: (files: FileList | null) => Promise<void>;
  removeReferenceImage: (index: number) => void;
  replaceReferenceImage: (index: number, file: File | undefined) => Promise<void>;
  refillFromTask: (task: GenerationTaskSummary) => void;
  openImagePreview: (preview: ImagePreview) => void;
}) {
  const suitePromptsReady =
    generationPreset !== "ecommerce_suite" ||
    (suiteImagePrompts.length === imageCount && suiteImagePrompts.every((prompt) => Boolean(prompt.trim())));

  return (
    <div className="space-y-6">
      <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={createTask}>
        <section className="sayhadow-create-composer relative overflow-hidden rounded-[2rem] bg-black/20 p-5 md:p-6">
          <div className="sayhadow-live-panel-glow pointer-events-none absolute inset-0" />
          <div className="relative flex items-center gap-2">
            <ImagePlus className="h-5 w-5 text-sky-300" aria-hidden={true} />
            <h2 className="text-lg font-semibold">图片生成</h2>
          </div>

          {appliedTemplate ? (
            <div className="relative mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/20 bg-sky-300/10 px-4 py-3">
              <div>
                <div className="text-xs font-semibold text-sky-700">当前模板</div>
                <div className="mt-1 text-sm font-semibold text-slate-950">{appliedTemplate.title}</div>
              </div>
              <button
                className="h-8 rounded-md border border-sky-200 bg-white px-3 text-xs font-semibold text-sky-800 hover:bg-sky-100"
                type="button"
                onClick={clearAppliedTemplate}
              >
                清除模板
              </button>
            </div>
          ) : null}

          {generationPreset !== "custom" ? (
            <div className="relative mt-4 rounded-2xl border border-white/10 bg-white/[0.06] p-4 text-white">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold">{getPresetMeta(generationPreset).title}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-300">
                    {getPresetMeta(generationPreset).description}
                  </p>
                </div>
                <button
                  className="h-8 rounded-md border border-white/20 px-3 text-xs font-semibold text-white hover:bg-white/10"
                  type="button"
                  onClick={() => setGenerationPreset("custom")}
                >
                  退出套图模式
                </button>
              </div>
              <div className="mt-4">
                <div className="text-xs font-semibold text-slate-300">生成张数</div>
                <div className={`mt-2 grid max-w-lg gap-2 ${getPresetMeta(generationPreset).counts.length === 3 ? "grid-cols-3" : "grid-cols-3 sm:grid-cols-6"}`}>
                  {getPresetMeta(generationPreset).counts.map((count) => (
                    <button
                      className={`h-10 rounded-md text-sm font-semibold transition ${
                        imageCount === count
                          ? "bg-white text-slate-950"
                          : "border border-white/25 text-white hover:bg-white/10"
                      }`}
                      key={count}
                      type="button"
                      onClick={() => setImageCount(count)}
                    >
                      {count} 张
                    </button>
                  ))}
                </div>
              </div>
              {generationPreset === "ecommerce_suite" ? (
                <div className="mt-5">
                  <div className="text-xs font-semibold text-slate-300">套图策划方式</div>
                  <div className="mt-2 grid max-w-sm grid-cols-2 gap-2">
                    {(["manual", "auto"] as const).map((mode) => (
                      <button
                        className={`h-10 rounded-md text-sm font-semibold transition ${
                          suitePlanningMode === mode
                            ? "bg-white text-slate-950"
                            : "border border-white/25 text-white hover:bg-white/10"
                        }`}
                        key={mode}
                        type="button"
                        onClick={() => setSuitePlanningMode(mode)}
                      >
                        {mode === "manual" ? "手动模式" : "自动模式"}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">
                    {suitePlanningMode === "manual"
                      ? "读取后台内置模板，生成可编辑的单图 Prompt 卡片。"
                      : "保留多模态自动策划入口。当前先生成可编辑占位卡片。"}
                  </p>
                </div>
              ) : null}
              {generationPreset === "ecommerce_main" ? (
                <div className="mt-5">
                  <div className="text-xs font-semibold text-slate-300">主图风格</div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {ecommerceMainStyles.map((style) => (
                      <button
                        className={`rounded-md border px-3 py-3 text-left transition ${
                          selectedMainStyleId === style.id
                            ? "border-white bg-white text-slate-950"
                            : "border-white/20 bg-white/5 text-white hover:bg-white/10"
                        }`}
                        key={style.id}
                        type="button"
                        onClick={() => setSelectedMainStyleId(style.id)}
                      >
                        <span className="block text-sm font-semibold">{style.label}</span>
                        <span className={`mt-1 block text-xs leading-5 ${selectedMainStyleId === style.id ? "text-slate-600" : "text-slate-400"}`}>
                          {style.description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

        <section className="relative mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">参考图</div>
              <p className="mt-1 text-xs text-slate-500">最多添加 10 张。顺位会按左到右、从上到下依次传给生图接口。</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{referenceImages.length}/10</span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {referenceImages.map((image, index) => (
              <article className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50" key={`${image.fileName}-${index}`}>
                <div className="relative aspect-square bg-white">
                  <img alt={`参考图 ${index + 1}`} className="h-full w-full object-cover" src={image.dataUri} />
                </div>
                <div className="p-2">
                  <div className="truncate text-xs text-slate-500" title={image.fileName}>{image.fileName}</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <label className="inline-flex h-8 cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white text-xs font-semibold text-slate-700">
                      替换
                      <input
                        accept="image/*"
                        className="sr-only"
                        type="file"
                        onChange={(event) => {
                          void replaceReferenceImage(index, event.currentTarget.files?.[0]);
                          event.currentTarget.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-md border border-red-200 bg-white text-xs font-semibold text-red-700"
                      type="button"
                      onClick={() => removeReferenceImage(index)}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden={true} />
                      删除
                    </button>
                  </div>
                </div>
              </article>
            ))}

            {referenceImages.length < 10 ? (
              <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-sky-300/30 bg-white/[0.055] px-3 text-center text-xs font-semibold text-slate-500 transition hover:border-sky-300/60 hover:bg-white/[0.09]">
                <Upload className="h-6 w-6" aria-hidden={true} />
                添加参考图
                <input
                  accept="image/*"
                  className="sr-only"
                  multiple={true}
                  name="referenceImages"
                  type="file"
                  onChange={(event) => {
                    void addReferenceImages(event.currentTarget.files);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            ) : null}
          </div>
        </section>

        <label className="relative mt-5 grid gap-2 text-sm font-medium">
          <span>产品名</span>
          <input
            className="h-11 rounded-2xl border border-slate-300 px-4 outline-none transition focus:border-sky-300"
            maxLength={100}
            name="productName"
            placeholder="可选：例如 公文包水枪、手机支架、发声企鹅"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
          />
          <span className="text-right text-xs text-slate-500">{productName.length}/100</span>
        </label>

        <label className="relative mt-5 grid gap-2 text-sm font-medium">
          <span>{generationPreset !== "custom" ? "额外补充 Prompt" : "Prompt"}</span>
          <textarea
            className="min-h-44 resize-y rounded-2xl border border-slate-300 px-4 py-4 outline-none transition focus:border-sky-300"
            maxLength={generationPreset !== "custom" ? 1000 : 2000}
            name="prompt"
            placeholder={
              generationPreset !== "custom"
                ? "可选：补充商品名称、风格、平台、主色、禁忌元素等。主提示词已内置在后端。"
                : "描述你想生成/修改的内容，例如：这是一个手机支架，请分析卖点并生成一张高级感电商主图。"
            }
            value={promptText}
            onChange={(event) => setPromptText(event.target.value)}
          />
          <span className="text-right text-xs text-slate-500">{promptText.length}/{generationPreset !== "custom" ? 1000 : 2000}</span>
        </label>

        {generationPreset === "ecommerce_suite" ? (
          <section className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">单图 Prompt 卡片</h3>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  每张卡片会独立交给 Worker。你可以在提交前逐条修改。
                </p>
              </div>
              <button
                className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60"
                disabled={isPlanningSuite}
                type="button"
                onClick={() => void planEcommerceSuite()}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isPlanningSuite ? "animate-spin" : ""}`} aria-hidden={true} />
                重新生成 Prompt
              </button>
            </div>
            {suitePlanMessage ? <p className="mt-3 text-xs leading-5 text-slate-600">{suitePlanMessage}</p> : null}
            {isPlanningSuite ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} />
                正在生成 Prompt 卡片
              </div>
            ) : (
              <div className="mt-4 grid gap-3">
                {suiteImagePrompts.map((prompt, index) => (
                  <label className="grid gap-2 rounded-md border border-slate-200 bg-white p-3" key={index}>
                    <span className="text-xs font-semibold text-slate-500">图片 {index + 1}</span>
                    <textarea
                      className="min-h-32 resize-y rounded-md border border-slate-200 px-3 py-2 text-sm leading-6 outline-none transition focus:border-slate-950"
                      maxLength={6000}
                      value={prompt}
                      onChange={(event) => updateSuiteImagePrompt(index, event.target.value)}
                    />
                    <span className="text-right text-xs text-slate-400">{prompt.length}/6000</span>
                  </label>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold">生成参数</h2>
          <div className="mt-4">
            <div className="text-sm font-medium">分辨率</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {resolutions.map((resolution) => (
                <button
                  className={`h-10 rounded-md border text-sm font-semibold transition ${
                    selectedResolution === resolution ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  key={resolution}
                  type="button"
                  onClick={() => setSelectedResolution(resolution)}
                >
                  {resolution.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4">
            <div className="text-sm font-medium">尺寸</div>
            <div className="mt-2 grid grid-cols-4 gap-2">
              {aspectRatios.map((aspectRatio) => (
                <button
                  className={`h-9 rounded-md border text-xs font-semibold transition ${
                    selectedAspectRatio === aspectRatio.value
                      ? "border-slate-950 bg-slate-950 text-white"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                  key={aspectRatio.value}
                  type="button"
                  onClick={() => setSelectedAspectRatio(aspectRatio.value)}
                >
                  {aspectRatio.label}
                </button>
              ))}
            </div>
          </div>

          {generationPreset === "custom" ? (
            <label className="mt-4 grid gap-2 text-sm font-medium">
              <span>生成张数</span>
              <input
                className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
                max="10"
                min="1"
                type="number"
                value={imageCount}
                onChange={(event) => {
                  const nextCount = Number(event.currentTarget.value);
                  setImageCount(Number.isInteger(nextCount) && nextCount > 0 ? Math.min(nextCount, 10) : 1);
                }}
              />
            </label>
          ) : (
            <div className="mt-4 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
              当前预设将生成 <span className="font-semibold">{imageCount} 张</span>独立图片
            </div>
          )}

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-slate-500">预计消耗</span>
              <span className="text-lg font-semibold">{pointCost} 点</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">1K 每张 10 点，2K 每张 20 点，4K 每张 40 点。提交后会先预扣，失败任务会退款。</p>
          </div>

          {message ? <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p> : null}

          <button
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white disabled:opacity-60"
            disabled={isSubmitting || isPlanningSuite || !suitePromptsReady || (generationPreset === "custom" && !promptText.trim())}
            type="submit"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} /> : <Send className="h-4 w-4" aria-hidden={true} />}
            提交生成任务
          </button>
        </section>

        <InlineResultPanel assets={recentAssets.slice(0, 2)} tasks={recentTasks.slice(0, 2)} openImagePreview={openImagePreview} />
      </aside>
      </form>

      <SuiteFeatureCards
        imageCount={imageCount}
        generationPreset={generationPreset}
        setGenerationPreset={setGenerationPreset}
        setImageCount={setImageCount}
      />

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">生成结果</h2>
            <p className="mt-1 text-sm text-slate-500">任务提交后会在这里显示实时状态；生成完成后，每张图片都会单独显示成卡片。</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            最近 {recentAssets.length} 张结果
          </span>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {recentTasks
            .filter((task) => task.status === "queued" || task.status === "processing")
            .map((task) => (
              <LiveTaskCard key={task.id} task={task} refillFromTask={refillFromTask} />
            ))}
          {recentAssets.map((asset) => (
            <AssetCard asset={asset} copyPrompt={copyPrompt} key={asset.id} openImagePreview={openImagePreview} />
          ))}
        </div>

        {recentTasks.length === 0 && recentAssets.length === 0 ? <EmptyState text="暂无生成结果" /> : null}
      </section>
    </div>
  );
}

function GalleryView({
  assets,
  query,
  setQuery,
  copyPrompt,
  openImagePreview
}: {
  assets: ResultAssetSummary[];
  query: string;
  setQuery: (query: string) => void;
  copyPrompt: (prompt: string) => Promise<void>;
  openImagePreview: (preview: ImagePreview) => void;
}) {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<Set<string>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadMessage, setDownloadMessage] = useState("");
  const selectedAssets = assets.filter((asset) => selectedAssetIds.has(asset.id));
  const allVisibleSelected = assets.length > 0 && selectedAssets.length === assets.length;

  const toggleSelected = (assetId: string) => {
    setSelectedAssetIds((current) => {
      const next = new Set(current);

      if (next.has(assetId)) {
        next.delete(assetId);
      } else {
        next.add(assetId);
      }

      return next;
    });
  };

  const leaveSelectionMode = () => {
    setSelectionMode(false);
    setSelectedAssetIds(new Set());
    setDownloadMessage("");
  };

  const downloadSelected = async () => {
    if (selectedAssets.length === 0) {
      return;
    }

    setIsDownloading(true);
    setDownloadMessage("");

    try {
      await downloadResultAssets(selectedAssets, (completed, total) => {
        setDownloadMessage(`正在下载 ${completed}/${total}`);
      });
      setDownloadMessage(`已开始下载 ${selectedAssets.length} 张图片`);
    } catch (error) {
      setDownloadMessage(error instanceof Error ? error.message : "批量下载失败");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">结果图库</h2>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative block min-w-[260px] md:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
            <input
              className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-slate-950"
              placeholder="搜索 Prompt"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          {selectionMode ? (
            <button className="h-10 rounded-md border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50" type="button" onClick={leaveSelectionMode}>
              完成
            </button>
          ) : (
            <button
              className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-semibold hover:bg-slate-50"
              type="button"
              onClick={() => setSelectionMode(true)}
            >
              <CheckSquare className="h-4 w-4" aria-hidden={true} />
              批量选择
            </button>
          )}
        </div>
      </div>
      {selectionMode ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <span className="mr-auto text-sm font-semibold">已选 {selectedAssets.length} 张</span>
          <button
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100"
            type="button"
            onClick={() => setSelectedAssetIds(allVisibleSelected ? new Set() : new Set(assets.map((asset) => asset.id)))}
          >
            {allVisibleSelected ? "取消全选" : "全选当前结果"}
          </button>
          <button
            className="h-9 rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedAssets.length === 0}
            type="button"
            onClick={() => setSelectedAssetIds(new Set())}
          >
            取消选择
          </button>
          <button
            className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={selectedAssets.length === 0 || isDownloading}
            type="button"
            onClick={() => void downloadSelected()}
          >
            {isDownloading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden={true} /> : <Download className="h-4 w-4" aria-hidden={true} />}
            批量下载
          </button>
          {downloadMessage ? <span className="w-full text-xs text-slate-600">{downloadMessage}</span> : null}
        </div>
      ) : null}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {assets.map((asset) => (
          <AssetCard asset={asset} copyPrompt={copyPrompt} key={asset.id} selected={selectedAssetIds.has(asset.id)} selectionMode={selectionMode} toggleSelected={toggleSelected} openImagePreview={openImagePreview} />
        ))}
      </div>
      {assets.length === 0 ? <EmptyState text="暂无结果图" /> : null}
    </section>
  );
}

function SuiteFeatureCards({
  generationPreset,
  imageCount,
  setGenerationPreset,
  setImageCount
}: {
  generationPreset: GenerationPreset;
  imageCount: number;
  setGenerationPreset: (preset: GenerationPreset) => void;
  setImageCount: (count: number) => void;
}) {
  const selectPreset = (card: (typeof generationModeCardConfigs)[number]) => {
    const counts = card.preset === "custom" ? [card.defaultCount] : getPresetMeta(card.preset).counts;
    setGenerationPreset(card.preset);
    setImageCount(counts.includes(imageCount) ? imageCount : card.defaultCount);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <section className="rounded-[2rem] border border-white/10 bg-black/20 p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold">生图模式</h2>
          <p className="mt-1 text-sm text-slate-500">选择一个电商生图模式，张数和补充要求会在上方工作台中配置。</p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {generationModeCardConfigs.map((card) => (
          <HomeModeCard
            active={generationPreset === card.preset}
            description={card.description}
            icon={card.icon}
            imageUrls={card.imageUrls}
            key={card.preset}
            title={card.title}
            onClick={() => selectPreset(card)}
          />
        ))}
      </div>
    </section>
  );
}

function PointsView({ balance, transactions }: { balance: PointBalanceSummary; transactions: PointTransactionSummary[] }) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2">
        <MetricCard icon={Coins} title="可用点数" value={String(balance.available)} />
        <MetricCard icon={WalletCards} title="预扣点数" value={String(balance.held)} />
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">点数流水</h2>
        <DataTable
          emptyText="暂无点数流水"
          headers={["类型", "点数", "状态", "任务", "时间"]}
          rows={transactions.map((transaction) => [
            formatTransactionType(transaction.type),
            `${transaction.amount >= 0 ? "+" : ""}${transaction.amount}`,
            formatTransactionStatus(transaction.status),
            transaction.taskId ?? "-",
            new Date(transaction.createdAt).toLocaleString()
          ])}
        />
      </section>
    </div>
  );
}

function AdminUsersView({
  users,
  submittingUserId,
  grantPoints,
  deductPoints,
  deleteUser
}: {
  users: AdminUserSummary[];
  submittingUserId: string | null;
  grantPoints: (event: FormEvent<HTMLFormElement>, userId: string) => Promise<void>;
  deductPoints: (event: FormEvent<HTMLFormElement>, userId: string) => Promise<void>;
  deleteUser: (userId: string, email: string) => Promise<void>;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">用户管理</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1320px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="py-3 pr-4 font-medium">用户</th>
              <th className="py-3 pr-4 font-medium">角色</th>
              <th className="py-3 pr-4 font-medium">可用</th>
              <th className="py-3 pr-4 font-medium">预扣</th>
              <th className="py-3 pr-4 font-medium">任务/资产</th>
              <th className="py-3 pr-4 font-medium">充值</th>
              <th className="py-3 pr-4 font-medium">扣除积分</th>
              <th className="py-3 font-medium">删除</th>
            </tr>
          </thead>
          <tbody>
            {users.map((adminUser) => (
              <tr key={adminUser.id} className="border-b border-slate-100 align-top">
                <td className="py-3 pr-4">
                  <div className="font-semibold">{adminUser.displayName || adminUser.email}</div>
                  <div className="mt-1 text-xs text-slate-500">{adminUser.email}</div>
                </td>
                <td className="py-3 pr-4">{adminUser.role === "admin" ? "管理员" : "用户"}</td>
                <td className="py-3 pr-4 font-semibold">{adminUser.pointsAvailable}</td>
                <td className="py-3 pr-4">{adminUser.pointsHeld}</td>
                <td className="py-3 pr-4">
                  {adminUser.generationTaskCount}/{adminUser.resultAssetCount}
                </td>
                <td className="py-3 pr-4">
                  <form className="flex flex-wrap gap-2" onSubmit={(event) => grantPoints(event, adminUser.id)}>
                    <input className="h-9 w-28 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950" min="1" max="1000000" name="amount" placeholder="点数" required={true} type="number" />
                    <input className="h-9 w-52 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950" maxLength={200} name="reason" placeholder="备注" />
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={submittingUserId === adminUser.id}
                      type="submit"
                    >
                      <Coins className="h-4 w-4" aria-hidden={true} />
                      充值
                    </button>
                  </form>
                </td>
                <td className="py-3 pr-4">
                  <form className="flex flex-wrap gap-2" onSubmit={(event) => deductPoints(event, adminUser.id)}>
                    <input className="h-9 w-28 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950" min="1" max="1000000" name="amount" placeholder="点数" required={true} type="number" />
                    <input className="h-9 w-52 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950" maxLength={200} name="reason" placeholder="备注" />
                    <button
                      className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-700 disabled:opacity-60"
                      disabled={submittingUserId === adminUser.id}
                      type="submit"
                    >
                      <Coins className="h-4 w-4" aria-hidden={true} />
                      扣除
                    </button>
                  </form>
                </td>
                <td className="py-3">
                  <button
                    className="inline-flex h-9 items-center gap-2 rounded-md border border-red-200 px-3 text-sm font-semibold text-red-600 disabled:opacity-60"
                    disabled={submittingUserId === adminUser.id}
                    type="button"
                    onClick={() => void deleteUser(adminUser.id, adminUser.email)}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden={true} />
                    删除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {users.length === 0 ? <EmptyState text="暂无用户" /> : null}
      </div>
    </section>
  );
}

function AdminTasksView({
  overview,
  tasks,
  query,
  selectedStatus,
  setQuery,
  setSelectedStatus
}: {
  overview: AdminOverviewSummary | null;
  tasks: AdminGenerationTaskSummary[];
  query: string;
  selectedStatus: GenerationStatus | "all";
  setQuery: (query: string) => void;
  setSelectedStatus: (status: GenerationStatus | "all") => void;
}) {
  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Users} title="用户数" value={String(overview?.totalUsers ?? 0)} />
        <MetricCard icon={Activity} title="任务数" value={String(overview?.totalTasks ?? 0)} />
        <MetricCard icon={Loader2} title="处理中" value={String((overview?.queuedTasks ?? 0) + (overview?.processingTasks ?? 0))} />
        <MetricCard icon={Coins} title="平台点数" value={`${overview?.totalAvailablePoints ?? 0}/${overview?.totalHeldPoints ?? 0}`} />
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">任务日志与 Provider 调用</h2>
          <label className="relative block min-w-[260px] md:w-96">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
            <input
              className="h-10 w-full rounded-md border border-slate-300 pl-9 pr-3 text-sm outline-none focus:border-slate-950"
              placeholder="搜索用户邮箱或 Prompt"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {taskStatuses.map((status) => (
            <button
              className={`h-9 rounded-md border px-3 text-sm font-semibold ${
                selectedStatus === status ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white hover:bg-slate-50"
              }`}
              key={status}
              type="button"
              onClick={() => setSelectedStatus(status)}
            >
              {formatTaskStatus(status)}
            </button>
          ))}
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1120px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="py-3 pr-4 font-medium">任务</th>
                <th className="py-3 pr-4 font-medium">用户</th>
                <th className="py-3 pr-4 font-medium">状态</th>
                <th className="py-3 pr-4 font-medium">点数</th>
                <th className="py-3 pr-4 font-medium">Provider 调用</th>
                <th className="py-3 font-medium">时间</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id} className="border-b border-slate-100 align-top">
                  <td className="max-w-96 py-3 pr-4">
                    <div className="line-clamp-2 font-semibold">{task.prompt}</div>
                    {task.errorMessage ? <div className="mt-1 text-xs text-red-700">{task.errorMessage}</div> : null}
                    <div className="mt-1 text-xs text-slate-500">{task.id}</div>
                  </td>
                  <td className="py-3 pr-4">
                    <div className="font-medium">{task.userDisplayName || task.userEmail}</div>
                    <div className="mt-1 text-xs text-slate-500">{task.userEmail}</div>
                  </td>
                  <td className="py-3 pr-4">{formatTaskStatus(task.status)}</td>
                  <td className="py-3 pr-4">{task.pointCost}</td>
                  <td className="py-3 pr-4">
                    <div>{task.latestProviderCall?.provider ?? task.provider}</div>
                    <div className="mt-1 text-xs text-slate-500">{formatProviderCall(task.latestProviderCall)}</div>
                  </td>
                  <td className="py-3 text-slate-500">{new Date(task.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {tasks.length === 0 ? <EmptyState text="暂无任务日志" /> : null}
        </div>
      </section>
    </div>
  );
}

function AdminTemplatesView({
  editingTemplate,
  templates,
  saveTemplate,
  setEditingTemplateId,
  toggleTemplatePublished
}: {
  editingTemplate: TemplateSummary | null;
  templates: TemplateSummary[];
  saveTemplate: (event: FormEvent<HTMLFormElement>, templateId: string | null) => Promise<void>;
  setEditingTemplateId: (templateId: string | null) => void;
  toggleTemplatePublished: (template: TemplateSummary) => Promise<void>;
}) {
  const defaults = editingTemplate ? readTemplateRecipe(editingTemplate) : null;
  const [previewUrl, setPreviewUrl] = useState(defaults?.previewUrl ?? fallbackTemplatePreviewUrl);

  useEffect(() => {
    setPreviewUrl(defaults?.previewUrl ?? fallbackTemplatePreviewUrl);
  }, [defaults?.previewUrl, editingTemplate?.id]);

  return (
    <section className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <form
        className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        key={editingTemplate?.id ?? "new-template"}
        onSubmit={(event) => saveTemplate(event, editingTemplate?.id ?? null)}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">{editingTemplate ? "编辑模板" : "新建模板"}</h2>
            <p className="mt-1 text-sm text-slate-500">字段会保存为模板配方，用户点击后自动回填工作台。</p>
          </div>
          {editingTemplate ? (
            <button
              className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50"
              type="button"
              onClick={() => setEditingTemplateId(null)}
            >
              新建
            </button>
          ) : null}
        </div>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>模板名称</span>
          <input
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
            defaultValue={editingTemplate?.title ?? ""}
            maxLength={80}
            name="title"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>简介</span>
          <textarea
            className="min-h-20 resize-y rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-950"
            defaultValue={editingTemplate?.description ?? ""}
            maxLength={500}
            name="description"
          />
        </label>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium">
            <span>用途分类</span>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
              defaultValue={defaults?.category ?? "suite"}
              name="category"
            >
              {templateCategories
                .filter((category) => category.id !== "all")
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                  </option>
                ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>生成模式</span>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
              defaultValue={defaults?.preset ?? "ecommerce_suite"}
              name="preset"
            >
              <option value="ecommerce_suite">电商套图</option>
              <option value="ecommerce_main">电商主图</option>
              <option value="ecommerce_scene">电商场景图</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <label className="grid gap-2 text-sm font-medium">
            <span>张数</span>
            <input
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
              defaultValue={defaults?.imageCount ?? 3}
              max={50}
              min={1}
              name="imageCount"
              required={true}
              type="number"
            />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>分辨率</span>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
              defaultValue={defaults?.resolution ?? "1k"}
              name="resolution"
            >
              <option value="1k">1K</option>
              <option value="2k">2K</option>
              <option value="4k">4K</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>尺寸</span>
            <select
              className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
              defaultValue={defaults?.aspectRatio ?? "1:1"}
              name="aspectRatio"
            >
              {aspectRatios.map((aspectRatio) => (
                <option key={aspectRatio.value} value={aspectRatio.value}>
                  {aspectRatio.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-medium">
            <span>状态</span>
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm">
              <input defaultChecked={editingTemplate?.isPublished ?? false} name="isPublished" type="checkbox" />
              上架
            </span>
          </label>
        </div>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>主图风格</span>
          <select
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
            defaultValue={defaults?.mainStyleId ?? defaultEcommerceMainStyleId}
            name="mainStyleId"
          >
            {ecommerceMainStyles.map((style) => (
              <option key={style.id} value={style.id}>
                {style.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>模板 Prompt</span>
          <textarea
            className="min-h-28 resize-y rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-950"
            defaultValue={editingTemplate?.prompt ?? ""}
            maxLength={6000}
            name="prompt"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>默认额外 Prompt</span>
          <textarea
            className="min-h-24 resize-y rounded-md border border-slate-300 px-3 py-2 outline-none focus:border-slate-950"
            defaultValue={defaults?.extraPrompt ?? ""}
            maxLength={1000}
            name="extraPrompt"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>负面提示词</span>
          <input
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
            defaultValue={editingTemplate?.negativePrompt ?? ""}
            maxLength={1000}
            name="negativePrompt"
          />
        </label>

        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>标签</span>
          <input
            className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950"
            defaultValue={defaults?.tags.join("，") ?? ""}
            name="tags"
            placeholder="玩具，拼多多，高点击"
          />
        </label>

        <TemplatePreviewPicker previewUrl={previewUrl} setPreviewUrl={setPreviewUrl} />

        <button className="mt-5 h-10 w-full rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">
          保存模板
        </button>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">模板列表</h2>
            <p className="mt-1 text-sm text-slate-500">上架模板会出现在普通用户的模板广场。</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            {templates.filter((template) => template.isPublished).length}/{templates.length} 已上架
          </span>
        </div>

        <div className="mt-5 grid gap-3">
          {templates.map((template) => {
            const recipe = readTemplateRecipe(template);

            return (
              <article className="rounded-lg border border-slate-200 p-4" key={template.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{template.title}</h3>
                      <span className={`rounded-full px-2 py-1 text-xs font-semibold ${template.isPublished ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {template.isPublished ? "已上架" : "未上架"}
                      </span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{template.description}</p>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
                      <span className="rounded-full bg-slate-100 px-2 py-1">{formatTemplateCategory(recipe.category)}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{getPresetMeta(recipe.preset).title}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{recipe.imageCount} 张</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{recipe.resolution.toUpperCase()}</span>
                      <span className="rounded-full bg-slate-100 px-2 py-1">{getAspectRatioLabel(recipe.aspectRatio)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      className="h-9 rounded-md border border-slate-300 px-3 text-sm font-semibold hover:bg-slate-50"
                      type="button"
                      onClick={() => setEditingTemplateId(template.id)}
                    >
                      编辑
                    </button>
                    <button
                      className={`h-9 rounded-md px-3 text-sm font-semibold ${
                        template.isPublished
                          ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                          : "bg-slate-950 text-white hover:bg-slate-800"
                      }`}
                      type="button"
                      onClick={() => void toggleTemplatePublished(template)}
                    >
                      {template.isPublished ? "下架" : "上架"}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
          {templates.length === 0 ? <EmptyState text="暂无模板" /> : null}
        </div>
      </section>
    </section>
  );
}

interface TemplateCoverUploadResponse {
  id: string;
  contentUrl: string;
  mimeType: string;
  sizeBytes: number;
  originalFileName: string | null;
}

function TemplatePreviewPicker({
  previewUrl,
  setPreviewUrl
}: {
  previewUrl: string;
  setPreviewUrl: (previewUrl: string) => void;
}) {
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const displayUrl = localPreviewUrl ?? previewUrl;

  async function uploadPreviewFile(file: File | undefined) {
    if (!file) {
      return;
    }

    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setUploadMessage("预览图只支持 PNG、JPG 或 WebP。");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadMessage("预览图不能超过 5MB。");
      return;
    }

    const dataUri = await readFileAsDataUri(file);
    setLocalPreviewUrl(dataUri);
    setIsUploading(true);
    setUploadMessage("正在上传预览图...");

    try {
      const uploaded = await apiRequest<TemplateCoverUploadResponse>("/api/assets/template-covers", {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataUri
        })
      });

      setPreviewUrl(uploaded.contentUrl);
      setLocalPreviewUrl(null);
      setUploadMessage("预览图已上传。");
    } catch (caughtError) {
      setUploadMessage(caughtError instanceof Error ? caughtError.message : "预览图上传失败");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">预览图</div>
          <p className="mt-1 text-xs text-slate-500">选择本地图片作为模板封面，也可以粘贴已有图片 URL。</p>
        </div>
      </div>

      <img alt="模板预览图" className="mt-3 aspect-[4/3] w-full rounded-md border border-slate-200 bg-white object-cover" src={templatePreviewSrc(displayUrl)} />

      <label className="mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-4 py-5 text-center text-sm font-semibold text-slate-600 hover:bg-slate-50">
        <Upload className="h-5 w-5" aria-hidden={true} />
        选择自定义预览图
        <span className="text-xs font-normal text-slate-500">PNG / JPG / WebP，最大 5MB</span>
        <input
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          type="file"
          onChange={(event) => {
            void uploadPreviewFile(event.currentTarget.files?.[0]);
            event.currentTarget.value = "";
          }}
        />
      </label>

      {uploadMessage ? (
        <p className={`mt-2 text-xs ${isUploading ? "text-slate-500" : uploadMessage.includes("失败") || uploadMessage.includes("不能") || uploadMessage.includes("支持") ? "text-red-700" : "text-emerald-700"}`}>
          {uploadMessage}
        </p>
      ) : null}

      <label className="mt-3 grid gap-2 text-sm font-medium">
        <span>自定义 URL</span>
        <input
          className="h-10 rounded-md border border-slate-300 bg-white px-3 outline-none focus:border-slate-950"
          name="previewUrl"
          placeholder="https://..."
          value={previewUrl}
          onChange={(event) => setPreviewUrl(event.currentTarget.value)}
        />
      </label>
    </section>
  );
}

function InviteCodesView({
  inviteCodes,
  createInviteCode
}: {
  inviteCodes: InviteCodeSummary[];
  createInviteCode: (event: FormEvent<HTMLFormElement>) => Promise<void>;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={createInviteCode}>
        <h2 className="text-lg font-semibold">创建邀请码</h2>
        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>自定义码</span>
          <input className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950" name="code" placeholder="留空自动生成" />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>可用次数</span>
          <input className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950" name="maxUses" type="number" min="1" max="100" defaultValue="1" />
        </label>
        <label className="mt-4 grid gap-2 text-sm font-medium">
          <span>备注</span>
          <input className="h-10 rounded-md border border-slate-300 px-3 outline-none focus:border-slate-950" name="note" placeholder="例如：首批内测用户" />
        </label>
        <button className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-semibold text-white" type="submit">
          <BadgePlus className="h-4 w-4" aria-hidden={true} />
          创建
        </button>
      </form>
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold">邀请码列表</h2>
        <DataTable
          emptyText="暂无邀请码"
          headers={["邀请码", "状态", "使用", "备注", "创建时间"]}
          rows={inviteCodes.map((inviteCode) => [
            inviteCode.code,
            inviteCode.status,
            `${inviteCode.usedCount}/${inviteCode.maxUses}`,
            inviteCode.note ?? "-",
            new Date(inviteCode.createdAt).toLocaleString()
          ])}
        />
      </section>
    </section>
  );
}

function SettingsView({ user, balance }: { user: AuthUser; balance: PointBalanceSummary }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">用户与设置</h2>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <InfoLine label="邮箱" value={user.email} />
        <InfoLine label="显示名" value={user.displayName ?? "-"} />
        <InfoLine label="角色" value={user.role === "admin" ? "管理员" : "用户"} />
        <InfoLine label="协议状态" value={user.agreementStatus === "accepted" ? "已确认" : "待确认"} />
        <InfoLine label="可用点数" value={String(balance.available)} />
        <InfoLine label="预扣点数" value={String(balance.held)} />
      </div>
    </section>
  );
}

function SidebarItem({
  active,
  collapsed,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  collapsed: boolean;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-semibold transition ${
        active ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/10 hover:text-slate-200"
      } ${collapsed ? "justify-center" : ""}`}
      aria-label={label}
      type="button"
      onClick={onClick}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden={true} />
      {!collapsed ? <span>{label}</span> : null}
    </button>
  );
}

function SidebarSubItem({
  active,
  collapsed,
  label,
  onClick
}: {
  active: boolean;
  collapsed: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`group flex h-9 w-full items-center gap-2 rounded-lg text-xs font-semibold transition ${
        active ? "bg-white/14 text-white" : "text-slate-500 hover:bg-white/7 hover:text-slate-300"
      } ${collapsed ? "w-9 justify-center px-0" : "px-3"}`}
      aria-label={label}
      type="button"
      onClick={onClick}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full transition ${active ? "bg-white" : "bg-slate-600 group-hover:bg-slate-300"}`} />
      {!collapsed ? <span>{label}</span> : null}
    </button>
  );
}

function MetricCard({
  icon: Icon,
  title,
  value
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <Icon className="h-5 w-5 text-slate-700" aria-hidden={true} />
      <div className="mt-4 text-sm text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function FeatureTile({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="font-semibold">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-500">{text}</p>
    </div>
  );
}

function TaskMiniRow({ task, refillFromTask }: { task: GenerationTaskSummary; refillFromTask: (task: GenerationTaskSummary) => void }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="line-clamp-2 text-sm font-semibold">{task.prompt}</div>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{formatTaskStatus(task.status)}</span>
        <button className="font-semibold text-slate-700 hover:text-slate-950" type="button" onClick={() => refillFromTask(task)}>
          重新生成
        </button>
      </div>
    </div>
  );
}

function InlineResultPanel({
  assets,
  tasks,
  openImagePreview
}: {
  assets: ResultAssetSummary[];
  tasks: GenerationTaskSummary[];
  openImagePreview: (preview: ImagePreview) => void;
}) {
  const liveTasks = tasks.filter((task) => task.status === "queued" || task.status === "processing");

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold">实时结果</h2>
      <div className="mt-4 space-y-3">
        {liveTasks.map((task) => (
          <div className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2" key={task.id}>
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-md bg-white">
              <Loader2 className={`h-5 w-5 text-slate-500 ${task.status === "processing" ? "animate-spin" : ""}`} aria-hidden={true} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{formatTaskStatus(task.status)}</div>
              <div className="mt-1 line-clamp-2 text-xs text-slate-500">{task.prompt}</div>
            </div>
          </div>
        ))}
        {assets.map((asset) => {
          const url = resultAssetUrl(asset);

          return (
            <button
              className="flex w-full gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 text-left transition hover:bg-slate-100"
              key={asset.id}
              type="button"
              onClick={() =>
                openImagePreview({
                  downloadUrl: resultAssetDownloadUrl(asset),
                  imageUrl: url,
                  prompt: asset.prompt,
                  title: "查看结果图"
                })
              }
            >
              <img alt={asset.prompt} className="h-16 w-16 shrink-0 rounded-md object-cover" src={url} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">查看结果图</span>
                <span className="mt-1 line-clamp-2 block text-xs text-slate-500">{asset.prompt}</span>
              </span>
            </button>
          );
        })}
        {liveTasks.length === 0 && assets.length === 0 ? <EmptyState text="提交任务后显示在这里" /> : null}
      </div>
    </section>
  );
}

function LiveTaskCard({ task, refillFromTask }: { task: GenerationTaskSummary; refillFromTask: (task: GenerationTaskSummary) => void }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="flex aspect-square flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white text-center">
        <Loader2 className={`h-7 w-7 text-slate-500 ${task.status === "processing" ? "animate-spin" : ""}`} aria-hidden={true} />
        <div className="mt-3 text-sm font-semibold text-slate-700">{formatTaskStatus(task.status)}</div>
        <div className="mt-1 text-xs text-slate-500">完成后会自动显示图片卡片</div>
      </div>
      <div className="mt-4">
        <div className="line-clamp-2 min-h-10 text-sm font-semibold">{task.prompt}</div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{task.pointCost} 点</span>
          <button className="font-semibold text-slate-700 hover:text-slate-950" type="button" onClick={() => refillFromTask(task)}>
            重新生成
          </button>
        </div>
      </div>
    </article>
  );
}

function ResultGrid({
  tasks,
  compact,
  openImagePreview
}: {
  tasks: GenerationTaskSummary[];
  compact?: boolean;
  openImagePreview: (preview: ImagePreview) => void;
}) {
  return (
    <div className={`mt-5 grid gap-4 ${compact ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-4"}`}>
      {tasks.map((task) => (
        <TaskResultCard key={task.id} task={task} openImagePreview={openImagePreview} />
      ))}
      {tasks.length === 0 ? <EmptyState text="暂无生成结果" /> : null}
    </div>
  );
}

function TaskResultCard({ task, openImagePreview }: { task: GenerationTaskSummary; openImagePreview: (preview: ImagePreview) => void }) {
  const asset = task.assets[0];
  const url = asset ? assetUrl(asset) : "";

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {asset ? (
        <button
          className="block w-full"
          type="button"
          onClick={() =>
            openImagePreview({
              downloadUrl: assetDownloadUrl(asset),
              imageUrl: url,
              prompt: task.prompt,
              title: "查看生成结果"
            })
          }
        >
          <img alt={task.prompt} className="aspect-square w-full object-cover" src={url} />
        </button>
      ) : (
        <div className="grid aspect-square place-items-center bg-slate-100 text-sm text-slate-500">{formatTaskStatus(task.status)}</div>
      )}
      <div className="p-4">
        <div className="line-clamp-2 min-h-10 text-sm font-semibold">{task.prompt}</div>
        <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
          <span>{formatTaskStatus(task.status)}</span>
          <span>{task.pointCost} 点</span>
        </div>
        {asset ? (
          <div className="mt-4 flex gap-2">
            <button
              className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold"
              type="button"
              onClick={() =>
                openImagePreview({
                  downloadUrl: assetDownloadUrl(asset),
                  imageUrl: url,
                  prompt: task.prompt,
                  title: "查看生成结果"
                })
              }
            >
              预览
            </button>
          <a className="inline-flex h-9 w-10 items-center justify-center rounded-md border border-slate-200" download={true} href={assetDownloadUrl(asset)} title="下载">
              <Download className="h-4 w-4" aria-hidden={true} />
            </a>
          </div>
        ) : null}
      </div>
    </article>
  );
}

function AssetCard({
  asset,
  copyPrompt,
  openImagePreview,
  selected = false,
  selectionMode = false,
  toggleSelected
}: {
  asset: ResultAssetSummary;
  copyPrompt: (prompt: string) => Promise<void>;
  openImagePreview: (preview: ImagePreview) => void;
  selected?: boolean;
  selectionMode?: boolean;
  toggleSelected?: (assetId: string) => void;
}) {
  const url = resultAssetUrl(asset);
  const preview = {
    downloadUrl: resultAssetDownloadUrl(asset),
    imageUrl: url,
    prompt: asset.prompt,
    title: "查看结果图"
  };

  return (
    <article className={`relative overflow-hidden rounded-lg border bg-white shadow-sm ${selected ? "border-slate-950 ring-2 ring-slate-950/20" : "border-slate-200"}`}>
      {selectionMode ? (
        <button
          aria-label={selected ? "取消选择图片" : "选择图片"}
          className={`absolute left-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-md border shadow-sm ${selected ? "border-slate-950 bg-slate-950 text-white" : "border-slate-200 bg-white text-slate-700"}`}
          title={selected ? "取消选择" : "选择图片"}
          type="button"
          onClick={() => toggleSelected?.(asset.id)}
        >
          {selected ? <CheckSquare className="h-4 w-4" aria-hidden={true} /> : <Square className="h-4 w-4" aria-hidden={true} />}
        </button>
      ) : null}
      <button className="block w-full" type="button" onClick={() => (selectionMode ? toggleSelected?.(asset.id) : openImagePreview(preview))}>
        <img alt={asset.prompt} className="aspect-square w-full object-cover" src={url} />
      </button>
      <div className="p-4">
        <div className="line-clamp-2 min-h-10 text-sm font-semibold">{asset.prompt}</div>
        <div className="mt-3 text-xs text-slate-500">{new Date(asset.createdAt).toLocaleString()}</div>
        <div className="mt-4 flex gap-2">
          <button className="inline-flex h-9 flex-1 items-center justify-center rounded-md border border-slate-200 text-sm font-semibold" type="button" onClick={() => openImagePreview(preview)}>
            预览
          </button>
          <button className="inline-flex h-9 w-10 items-center justify-center rounded-md border border-slate-200" type="button" title="复制 Prompt" onClick={() => void copyPrompt(asset.prompt)}>
            <Copy className="h-4 w-4" aria-hidden={true} />
          </button>
          <a className="inline-flex h-9 w-10 items-center justify-center rounded-md border border-slate-200" download={true} href={resultAssetDownloadUrl(asset)} title="下载">
            <Download className="h-4 w-4" aria-hidden={true} />
          </a>
        </div>
      </div>
    </article>
  );
}

function DataTable({ headers, rows, emptyText }: { headers: string[]; rows: string[][]; emptyText: string }) {
  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-slate-500">
            {headers.map((header) => (
              <th className="py-3 pr-4 font-medium" key={header}>
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr className="border-b border-slate-100" key={`${row[0]}-${rowIndex}`}>
              {row.map((cell, cellIndex) => (
                <td className="py-3 pr-4" key={`${cell}-${cellIndex}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <EmptyState text={emptyText} /> : null}
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="col-span-full grid min-h-32 place-items-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
      {text}
    </div>
  );
}

function readFileAsDataUri(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Reference image could not be read"));
    });
    reader.addEventListener("error", () => reject(reader.error ?? new Error("Reference image could not be read")));
    reader.readAsDataURL(file);
  });
}

function getResolutionPointCost(resolution: Resolution) {
  return resolution === "4k" ? 40 : resolution === "2k" ? 20 : 10;
}

function readTemplateRecipe(template: { defaultParams: Record<string, unknown> }) {
  const params = template.defaultParams;
  const preset = readGenerationPreset(params);
  const normalizedPreset = preset === "custom" ? "ecommerce_suite" : preset;
  const category = readTemplateCategory(params.category, normalizedPreset);
  const configuredCount = typeof params.imageCount === "number" ? params.imageCount : normalizedPreset === "ecommerce_suite" ? 5 : 3;
  const allowedCounts = getPresetMeta(normalizedPreset).counts;
  const imageCount = allowedCounts.includes(configuredCount) ? configuredCount : allowedCounts[0];
  const mainStyleId = readEcommerceMainStyleId(params);

  return {
    category,
    preset: normalizedPreset,
    imageCount,
    resolution: readResolution(params),
    aspectRatio: readAspectRatio(params),
    mainStyleId,
    extraPrompt: typeof params.extraPrompt === "string" ? params.extraPrompt : "",
    tags: Array.isArray(params.tags) ? params.tags.filter((tag): tag is string => typeof tag === "string") : [],
    previewUrl:
      typeof params.previewUrl === "string" && params.previewUrl
        ? params.previewUrl
        : "https://images.unsplash.com/photo-1523275335684-37898b6baf30?auto=format&fit=crop&w=900&q=80"
  };
}

function readTemplateCategory(value: unknown, preset: Exclude<GenerationPreset, "custom">): Exclude<TemplateCategory, "all"> {
  if (value === "suite" || value === "main" || value === "scene" || value === "detail" || value === "promotion") {
    return value;
  }

  if (preset === "ecommerce_main") {
    return "main";
  }

  if (preset === "ecommerce_scene") {
    return "scene";
  }

  return "suite";
}

function formatTemplateCategory(category: Exclude<TemplateCategory, "all">) {
  const labels: Record<Exclude<TemplateCategory, "all">, string> = {
    suite: "商品套图",
    main: "平台主图",
    scene: "场景图",
    detail: "细节图",
    promotion: "活动图"
  };

  return labels[category];
}

function readResolution(params: Record<string, unknown>): Resolution {
  return params.resolution === "4k" ? "4k" : params.resolution === "2k" ? "2k" : "1k";
}

function readAspectRatio(params: Record<string, unknown>): AspectRatio {
  return aspectRatios.some((aspectRatio) => aspectRatio.value === params.aspectRatio)
    ? (params.aspectRatio as AspectRatio)
    : "1:1";
}

function getAspectRatioLabel(value: AspectRatio) {
  return aspectRatios.find((aspectRatio) => aspectRatio.value === value)?.label ?? "1:1";
}

function readGenerationPreset(params: Record<string, unknown>): GenerationPreset {
  return params.preset === "ecommerce_suite" || params.preset === "ecommerce_main" || params.preset === "ecommerce_scene"
    ? params.preset
    : "custom";
}

function readImageCount(params: Record<string, unknown>) {
  const maxCount = params.preset === "ecommerce_main" ? 50 : 10;
  return typeof params.imageCount === "number" && params.imageCount > 0 ? Math.min(params.imageCount, maxCount) : 1;
}

function readEcommerceMainStyleId(params: Record<string, unknown>): EcommerceMainStyleId {
  return ecommerceMainStyles.some((style) => style.id === params.mainStyleId)
    ? (params.mainStyleId as EcommerceMainStyleId)
    : defaultEcommerceMainStyleId;
}

function readSuitePlanningMode(params: Record<string, unknown>): SuitePlanningMode {
  return params.suitePlanningMode === "auto" ? "auto" : "manual";
}

function readSuiteImagePrompts(params: Record<string, unknown>) {
  return Array.isArray(params.imagePrompts)
    ? params.imagePrompts.filter((prompt): prompt is string => typeof prompt === "string")
    : [];
}

function readProductName(params: Record<string, unknown>) {
  return typeof params.productName === "string" ? params.productName : "";
}

function getPresetMeta(preset: Exclude<GenerationPreset, "custom">) {
  const presets = {
    ecommerce_suite: {
      title: "电商套图模式",
      description: "主提示词已由后端内置：会按主图、材质细节、使用场景、卖点说明等方向生成独立图片。请上传参考图、选择 3/5/10 张，并填写可选的补充要求。",
      counts: [3, 5, 10]
    },
    ecommerce_main: {
      title: "电商主图模式",
      description: "主提示词已由后端内置：请选择一种主图风格，系统会按同一风格生成不同画面的独立电商主图。请上传参考图、选择 1/3/5/10/20/50 张，并填写可选的补充要求。",
      counts: [1, 3, 5, 10, 20, 50]
    },
    ecommerce_scene: {
      title: "电商场景图模式",
      description: "主提示词已由后端内置：会保持统一视觉风格，生成不同使用场景的独立图片。请上传参考图、选择 1/3/5/10 张，并填写可选的补充要求。",
      counts: [1, 3, 5, 10]
    }
  } satisfies Record<Exclude<GenerationPreset, "custom">, { title: string; description: string; counts: number[] }>;

  return presets[preset];
}

function absoluteUrl(contentUrl: string) {
  return contentUrl.startsWith("http") ? contentUrl : `${getApiBaseUrl()}${contentUrl}`;
}

function assetUrl(asset: GenerationTaskSummary["assets"][number]) {
  return asset.contentUrl ? absoluteUrl(asset.contentUrl) : `${getApiBaseUrl()}/api/assets/results/${asset.id}/content`;
}

function assetDownloadUrl(asset: GenerationTaskSummary["assets"][number]) {
  const url = assetUrl(asset);
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

function resultAssetUrl(asset: ResultAssetSummary) {
  return asset.contentUrl ? absoluteUrl(asset.contentUrl) : `${getApiBaseUrl()}/api/assets/results/${asset.id}/content`;
}

function resultAssetDownloadUrl(asset: ResultAssetSummary) {
  const url = resultAssetUrl(asset);
  return `${url}${url.includes("?") ? "&" : "?"}download=1`;
}

function templatePreviewSrc(previewUrl: string) {
  if (previewUrl.startsWith("http") || previewUrl.startsWith("data:")) {
    return previewUrl;
  }

  return `${getApiBaseUrl()}${previewUrl}`;
}

async function downloadResultAssets(assets: ResultAssetSummary[], onProgress: (completed: number, total: number) => void) {
  for (const [index, asset] of assets.entries()) {
    const response = await fetch(resultAssetDownloadUrl(asset), {
      credentials: "include"
    });

    if (!response.ok) {
      throw new Error(`第 ${index + 1} 张图片下载失败`);
    }

    const objectUrl = URL.createObjectURL(await response.blob());
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = `ai-image-${String(index + 1).padStart(2, "0")}-${asset.id}.${getAssetExtension(asset.mimeType)}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    onProgress(index + 1, assets.length);
    await new Promise((resolve) => window.setTimeout(resolve, 180));
  }
}

function getAssetExtension(mimeType: string | null) {
  if (mimeType === "image/jpeg") {
    return "jpg";
  }

  if (mimeType === "image/webp") {
    return "webp";
  }

  return "png";
}

function getViewTitle(view: WorkspaceView) {
  const labels: Record<WorkspaceView, string> = {
    home: "首页",
    create: "图片生成",
    templates: "模板广场",
    gallery: "结果图库",
    points: "点数流水",
    "admin-users": "用户充值",
    "admin-tasks": "任务日志",
    "admin-templates": "模板管理",
    "admin-invites": "邀请码",
    settings: "用户与设置"
  };

  return labels[view];
}

function formatTaskStatus(status: GenerationStatus | "all") {
  const labels: Record<GenerationStatus | "all", string> = {
    all: "全部",
    draft: "草稿",
    queued: "排队中",
    processing: "生成中",
    succeeded: "已完成",
    failed: "失败",
    refunded: "已退款"
  };

  return labels[status];
}

function formatTransactionType(type: PointTransactionSummary["type"]) {
  const labels: Record<PointTransactionSummary["type"], string> = {
    admin_grant: "管理员充值",
    generation_hold: "生成预扣",
    generation_capture: "确认扣点",
    generation_refund: "失败退款",
    adjustment: "手动调整"
  };

  return labels[type];
}

function formatTransactionStatus(status: PointTransactionSummary["status"]) {
  const labels: Record<PointTransactionSummary["status"], string> = {
    pending: "处理中",
    committed: "已完成",
    reversed: "已撤销",
    failed: "失败"
  };

  return labels[status];
}

function formatProviderCall(call: AdminGenerationTaskSummary["latestProviderCall"]) {
  if (!call) {
    return "暂无调用记录";
  }

  if (call.errorMessage) {
    return call.errorMessage;
  }

  const statusCode = call.statusCode ? `${call.statusCode}` : "无状态码";
  const duration = call.durationMs === null ? "无耗时" : `${call.durationMs}ms`;
  return `${statusCode} · ${duration}`;
}

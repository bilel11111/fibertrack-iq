import { useState, useEffect, useRef } from "react";
import { Send, Settings, Sparkles, X, Bot, User, Cpu, Key, HelpCircle, Paperclip, Camera, Image, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { sqliteQuery } from "@/lib/sqlite-client";
import { useApp } from "@/hooks/use-app";

type Message = {
  role: "user" | "assistant";
  content: string;
  image?: string;
};

type Engine = "mock" | "gemini" | "openrouter" | "lmstudio";

export function AIAssistant({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { lang } = useApp();
  const isRtl = lang === "ar";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Dynamic initialization of greetings based on language
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content: lang === "ar"
            ? "مرحباً! أنا المساعد الذكي لـ SOTETEL FiberTrack. يمكنني مساعدتك في تحليل طوبولوجيا GPON، وتهيئة معدات OLT/FDT، أو تشخيص تنبيهات الانقطاع البصري والأعطال الميدانية. كيف يمكنني مساعدتك اليوم؟"
            : "Bonjour ! Je suis l'assistant intelligent SOTETEL FiberTrack. Je peux vous aider à analyser la topologie GPON, à configurer vos équipements OLT/FDT ou à diagnostiquer des alarmes de coupure optique. Comment puis-je vous aider aujourd'hui ?",
        },
      ]);
    }
  }, [lang]);

  // Settings states stored in localStorage
  const [engine, setEngine] = useState<Engine>("mock");
  const [apiKey, setApiKey] = useState("");
  const [endpoint, setEndpoint] = useState("http://localhost:1234/v1");
  const [model, setModel] = useState("gemini-2.5-flash");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Attachment states
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [attachedImageName, setAttachedImageName] = useState<string | null>(null);

  // Load settings from localStorage or /api/config
  useEffect(() => {
    async function loadConfig() {
      let savedEngine = localStorage.getItem("ft_ai_engine") as Engine;
      let savedKey = localStorage.getItem("ft_ai_key");
      let savedEndpoint = localStorage.getItem("ft_ai_endpoint");
      let savedModel = localStorage.getItem("ft_ai_model");

      try {
        const res = await fetch("/api/config");
        if (res.ok) {
          const envConfig = await res.json();
          if (!savedKey) {
            if (envConfig.GEMINI_API_KEY) {
              savedKey = envConfig.GEMINI_API_KEY;
              savedEngine = "gemini";
            } else if (envConfig.OPENROUTER_API_KEY) {
              savedKey = envConfig.OPENROUTER_API_KEY;
              savedEngine = "openrouter";
            }
          }
          if (!savedEndpoint && envConfig.LMSTUDIO_ENDPOINT) {
            savedEndpoint = envConfig.LMSTUDIO_ENDPOINT;
          }
        }
      } catch (err) {
        console.error("Failed to load environment config:", err);
      }

      if (savedEngine) setEngine(savedEngine);
      else if (!savedEngine) setEngine("mock");

      if (savedKey) setApiKey(savedKey);
      if (savedEndpoint) setEndpoint(savedEndpoint);
      if (savedModel) setModel(savedModel);
    }
    loadConfig();
  }, []);

  // Save settings
  const saveSettings = () => {
    localStorage.setItem("ft_ai_engine", engine);
    localStorage.setItem("ft_ai_key", apiKey);
    localStorage.setItem("ft_ai_endpoint", endpoint);
    localStorage.setItem("ft_ai_model", model);
    setShowSettings(false);
    toast.success("Paramètres de l'IA enregistrés !");
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachedImage) || loading) return;

    const userMsg = input.trim();
    const currentImage = attachedImage;
    const currentImageName = attachedImageName;

    setInput("");
    setAttachedImage(null);
    setAttachedImageName(null);

    const defaultUserMsg = lang === "ar" ? "تشخيص الصورة المرفقة" : "Diagnostic de la photo jointe";
    setMessages((prev) => [...prev, { role: "user", content: userMsg || defaultUserMsg, image: currentImage || undefined }]);
    setLoading(true);

    try {
      let reply = "";
      const isQueryArabic = /[\u0600-\u06FF]/.test(userMsg);
      const isAr = lang === "ar" || isQueryArabic;

      if (engine === "gemini") {
        if (!apiKey) {
          throw new Error(isAr 
            ? "مفتاح API الخاص بـ Gemini غير موجود. يرجى إعداده في الإعدادات."
            : "Clé API Gemini manquante. Veuillez configurer la clé API dans les réglages."
          );
        }
        const systemPrompt = `Tu es un expert télécom GPON FTTH pour SOTETEL sur la plateforme FiberTrack IQ. Tu es parfaitement bilingue (Arabe et Français). Réponds toujours dans la langue de la question posée (en français ou en arabe). Si l'ingénieur te pose une question sur le réseau, analyse les anomalies matérielles, de signal optique ou de stock et propose des solutions concrètes et professionnelles.
أنت خبير اتصالات GPON FTTH لشركة SOTETEL على منصة FiberTrack IQ. أنت ثنائي اللغة تماماً (العربية والفرنسية). أجب دائماً بلغة السؤال المطروح (الفرنسية أو العربية). إذا سألك المهندس عن الشبكة، فحلل الأعطال والمشاكل المادية أو الإشارة أو المخزون واقترح حلولاً ملموسة ومهنية.`;
        
        const parts: any[] = [{ text: `${systemPrompt}\n\nQuestion de l'ingénieur / سؤال المهندس: ${userMsg || "Analyse cette photo de fibre optique."}` }];
        if (currentImage) {
          parts.push({
            inline_data: {
              mime_type: currentImage.split(";")[0].split(":")[1],
              data: currentImage.split(",")[1]
            }
          });
        }
        
        // Use streaming API
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}&alt=sse`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ parts }],
            }),
          }
        );
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || "Erreur d'appel API Gemini");
        }

        // Add empty assistant message that will be updated
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let accumulatedText = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const jsonStr = line.slice(6);
                  if (jsonStr.trim() === "[DONE]") continue;
                  
                  const data = JSON.parse(jsonStr);
                  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                  
                  if (text) {
                    accumulatedText += text;
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1].content = accumulatedText;
                      return newMessages;
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          reply = accumulatedText || "Désolé, aucune réponse générée.";
        } else {
          throw new Error("Streaming not supported");
        }
      } else if (engine === "openrouter") {
        if (!apiKey) {
          throw new Error(isAr
            ? "مفتاح API الخاص بـ OpenRouter غير موجود. يرجى إعداده في الإعدادات."
            : "Clé API OpenRouter manquante. Veuillez configurer la clé API dans les réglages."
          );
        }
        const contentParts: any[] = [{ type: "text", text: userMsg || "Analyse cette photo." }];
        if (currentImage) {
          contentParts.push({
            type: "image_url",
            image_url: { url: currentImage }
          });
        }
        
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
            "HTTP-Referer": "http://localhost:8080",
          },
          body: JSON.stringify({
            model: model || "google/gemini-2.5-flash",
            stream: true,
            messages: [
              { role: "system", content: `Tu es un expert télécom GPON FTTH pour SOTETEL sur la plateforme FiberTrack IQ. Tu es parfaitement bilingue (Arabe et Français). Réponds toujours dans la langue de la question (français/arabe).
أنت خبير اتصالات GPON FTTH لشركة SOTETEL على منصة FiberTrack IQ. أنت ثنائي اللغة تماماً (العربية والفرنسية). أجب دائماً بلغة السؤال (الفرنسية/العربية).` },
              { role: "user", content: contentParts },
            ],
          }),
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error?.message || "Erreur OpenRouter API");
        }

        // Add empty assistant message that will be updated
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let accumulatedText = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const jsonStr = line.slice(6);
                  if (jsonStr.trim() === "[DONE]") continue;
                  
                  const data = JSON.parse(jsonStr);
                  const text = data.choices?.[0]?.delta?.content || "";
                  
                  if (text) {
                    accumulatedText += text;
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1].content = accumulatedText;
                      return newMessages;
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          reply = accumulatedText || "Aucune réponse de l'IA.";
        } else {
          throw new Error("Streaming not supported");
        }
      } else if (engine === "lmstudio") {
        const url = `${endpoint.replace(/\/$/, "")}/chat/completions`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: model || "local-model",
            stream: true,
            messages: [
              { role: "system", content: `Tu es un expert télécom GPON FTTH pour SOTETEL sur la plateforme FiberTrack IQ. Tu es parfaitement bilingue (Arabe et Français). Réponds toujours dans la langue de la question (français/arabe).
أنت خبير اتصالات GPON FTTH لشركة SOTETEL على منصة FiberTrack IQ. أنت ثنائي اللغة تماماً (العربية والفرنسية). أجب دائماً بلغة السؤال (الفرنسية/العربية).` },
              { role: "user", content: userMsg || "Analyse cette photo." },
            ],
          }),
        });
        
        if (!res.ok) throw new Error("Impossible de se connecter au serveur LM Studio local.");

        // Add empty assistant message that will be updated
        setMessages((prev) => [...prev, { role: "assistant", content: "" }]);
        
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        
        if (reader) {
          let accumulatedText = "";
          
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");
            
            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const jsonStr = line.slice(6);
                  if (jsonStr.trim() === "[DONE]") continue;
                  
                  const data = JSON.parse(jsonStr);
                  const text = data.choices?.[0]?.delta?.content || "";
                  
                  if (text) {
                    accumulatedText += text;
                    setMessages((prev) => {
                      const newMessages = [...prev];
                      newMessages[newMessages.length - 1].content = accumulatedText;
                      return newMessages;
                    });
                  }
                } catch (e) {
                  // Skip invalid JSON
                }
              }
            }
          }
          
          reply = accumulatedText || "Aucune réponse générée localement.";
        } else {
          throw new Error("Streaming not supported");
        }
      } else {
        // Live intelligent SOTETEL GPON/FTTH SQLite Database Search (Mock Engine)
        await new Promise((r) => setTimeout(r, 900));
        
        if (currentImage) {
          const lowerQuery = userMsg.toLowerCase();
          
          if (lowerQuery.includes("courbure") || lowerQuery.includes("rayon") || lowerQuery.includes("انحناء") || currentImageName?.toLowerCase().includes("courbe") || currentImageName?.toLowerCase().includes("bend")) {
            if (isAr) {
              reply = `🔍 **[تحليل الرؤية الاصطناعية لـ FiberTrack]**
  
**الجهاز المكتشف** : سلك توصيل بصري أحادي الوضعية (G.657.A2 / G.652.D)
**الخلل المرصود** : ⚠️ **انحناء ميكانيكي حرج (Macrocourbure)**
  
**تقرير الإشارة البصرية** :
- **نصف قطر الانحناء** : ~12 مم (أقل من الحد المسموح به البالغ 15 مم للألياف العادية).
- **التوهين المستحث** : ~ +3.8 ديسيبل عند طول موجة 1550 نانومتر.
  
**خطة عمل الميدان (فني SOTETEL)** :
1. قم بفك روابط الكابلات البلاستيكية المشدودة بقوة فوراً داخل المجرى.
2. أعد لف الألياف الزائدة داخل موجهات علبة اللحام بنصف قطر أكبر من 20 مم.
3. قم بقياس الطاقة الضوئية مرة أخرى للتأكد من استقرار الإشارة.`;
            } else {
              reply = `🔍 **[Analyse par Vision Artificielle FiberTrack]**
  
**Équipement détecté** : Jarretière optique monomode (G.652.D / G.657.A2)
**Anomalie visuelle** : ⚠️ **Macrocourbure critique détectée**
  
**Rapport d'analyse de signal** :
- **Rayon de courbure** : ~12mm (Inférieur au seuil nominal de 15mm pour fibre monomode standard).
- **Atténuation induite** : ~ +3.8 dB à 1550 nm.
  
**Plan d'action terrain (Technicien SOTETEL)** :
1. Relâchez immédiatement les colliers de serrage (serre-câbles) trop serrés dans la goulotte.
2. Ré-enroulez la jarretière dans les guides circulaires de la cassette de lovage en respectant un rayon > 20mm.
3. Effectuez un nouveau test de puissance optique après correction.`;
            }
          } else if (lowerQuery.includes("poussiere") || lowerQuery.includes("sale") || lowerQuery.includes("connecteur") || lowerQuery.includes("غبار") || lowerQuery.includes("تلوث") || currentImageName?.toLowerCase().includes("dirty") || currentImageName?.toLowerCase().includes("dust")) {
            if (isAr) {
              reply = `🔍 **[تحليل الرؤية الاصطناعية لـ FiberTrack]**
  
**الجهاز المكتشف** : رأس موصل بصري SC/APC (2.5 مم)
**الخلل المرصود** : 🔴 **تلوث شديد بالغبار والأتربة**
  
**تقرير الإشارة البصرية** :
- **سطح التلامس البصري** : جزيئات صلبة أو دهنية تغطي قلب الألياف (النواة النشطة بحجم 9 ميكرون).
- **فقد العودة (ORL)** : انخفاض إلى أقل من 35 ديسيبل (مما يسبب انعكاسات تشوش ليزر OLT).
- **التوهين المباشر المستحث** : +4.5 ديسيبل.
  
**خطة عمل الميدان (فني SOTETEL)** :
1. لا تقم بتوصيل الكابل بالمنفذ لتجنب خدش وتلف جهاز الاستقبال (ONT).
2. استخدم قلم تنظيف الألياف البصرية المخصص SC 2.5mm (One-Click Cleaner) واضغط مرتين.
3. افحص رأس Mocon بالمجهر البصري للتأكد من نظافته قبل إعادة إدخاله.`;
            } else {
              reply = `🔍 **[Analyse par Vision Artificielle FiberTrack]**
  
**Équipement détecté** : Férule de connecteur optique SC/APC (2.5mm)
**Anomalie visuelle** : 🔴 **Contamination par poussière sévère**
  
**Rapport d'analyse de signal** :
- **Surface de contact optique** : Présence de particules solides de silice et de gras sur le cœur de la fibre (zone active de 9 µm).
- **Perte de retour (ORL)** : Chute à < 35 dB (générant des réflexions perturbatrices pour l'émetteur laser OLT).
- **Atténuation directe** : +4.5 dBm.
  
**Plan d'action terrain (Technicien SOTETEL)** :
1. Ne reconnectez pas en l'état sous peine d'endommager physiquement le port récepteur de l'ONT.
2. Utilisez un stylo nettoyeur de fibre optique SC 2.5mm (One-Click Cleaner), insérez et cliquez 2 fois.
3. Inspectez à nouveau avec le microscope optique avant de ré-insérer le connecteur.`;
            }
          } else if (lowerQuery.includes("pbo") || lowerQuery.includes("boîtier") || lowerQuery.includes("صندوق") || lowerQuery.includes("علبة") || currentImageName?.toLowerCase().includes("pbo") || currentImageName?.toLowerCase().includes("box")) {
            if (isAr) {
              reply = `🔍 **[تحليل الرؤية الاصطناعية لـ FiberTrack]**
  
**الجهاز المكتشف** : صندوق التوزيع الخارجي PBO / BPI
**الخلل المرصود** : ⚠️ **قفل الصندوق غير محكم وتلف حشية منع التسرب**
  
**تقرير الحالة الفيزيائية** :
- **مقاومة العوامل الجوية** : غطاء الصندوق الرئيسي لا يغلق بنسبة 100%، مما يهدد بتسرب مياه الأمطار والرطوبة للداخل وتلف اللحامات.
- **التنظيم** : كابلات Drop الخارجة تفتقر إلى عوازل المطاط الواقية.
  
**خطة عمل الميدان (فني SOTETEL)** :
1. افحص علب اللحام الداخلية للتأكد من عدم وجود تكثف للمياه أو رطوبة، وجففها بلطف إذا لزم الأمر.
2. أعد تثبيت الشريط المطاطي الواقي في مجراه لضمان معيار الحماية IP65.
3. أغلق مزلاج الأمان بإحكام وشد برغي الحماية المضاد للسرقة.`;
            } else {
              reply = `🔍 **[Analyse par Vision Artificielle FiberTrack]**
  
**Équipement détecté** : Boîtier PBO / BPI (Point de Branchement Optique mural)
**Anomalie visuelle** : ⚠️ **Verrouillage défectueux & Joint d'étanchéité déplacé**
  
**Rapport d'analyse physique** :
- **Étanchéité** : Le clapet de fermeture principal n'est pas scellé à 100%. Exposition directe aux intempéries, risque d'infiltration d'eau dans les cassettes d'épissurage.
- **Organisation** : Jarretières drop abonnés sortant sans passe-câbles en caoutchouc.
  
**Plan d'action terrain (Technicien SOTETEL)** :
1. Inspectez s'il y a de la condensation ou de l'humidité sur les manchons de thermo-protection (tubes rétractables). Sechez délicatement si nécessaire.
2. Ré-insérez le joint en caoutchouc dans sa gorge périphérique pour garantir l'indice IP65.
3. Enclenchez fermement le loquet de sécurité et vissez la vis de maintien antivol.`;
            }
          } else {
            if (isAr) {
              reply = `🔍 **[تحليل الرؤية الاصطناعية لـ FiberTrack]**
  
**الملف الذي تم تحليله** : \`${currentImageName}\`
**العنصر الرئيسي** : معدات توزيع بصرية سليمة
**التشخيص** : الربط الفيزيائي مطابق للمواصفات القياسية. زاوية الانحناء وتوتر الكابلات تلبي متطلبات هندسة الـ FTTH.`;
            } else {
              reply = `🔍 **[Analyse par Vision Artificielle FiberTrack]**
  
**Fichier analysé** : \`${currentImageName}\`
**Élément principal** : Équipement de distribution optique
**Diagnostic** : Liaison structurelle conforme. Les rayons de courbure et la tension des câbles respectent les exigences de l'ingénierie FTTH.`;
            }
          }
        } else {
          const lower = userMsg.toLowerCase();
          try {
            if (lower.includes("salma") || lower.includes("labidi") || lower.includes("amine") || lower.includes("kamel") || lower.includes("client") || lower.includes("abonné") || lower.includes("raccordement") || lower.includes("عميل") || lower.includes("مشترك") || lower.includes("سلمى") || lower.includes("أمين") || lower.includes("كامل")) {
              let nameQuery = "%";
              if (lower.includes("salma") || lower.includes("سلمى")) nameQuery = "%Salma%";
              else if (lower.includes("labidi")) nameQuery = "%Labidi%";
              else if (lower.includes("amine") || lower.includes("أمين")) nameQuery = "%Amine%";
              else if (lower.includes("kamel") || lower.includes("كامل")) nameQuery = "%Kamel%";

              const results = await sqliteQuery(
                "SELECT * FROM installations WHERE client_name LIKE ? OR residence LIKE ? ORDER BY id DESC",
                [nameQuery, nameQuery]
              );

              if (results.length > 0) {
                const client = results[0];
                const conn = await sqliteQuery(
                  "SELECT * FROM connections WHERE residence = ? AND bloc = ? AND appartement = ?",
                  [client.residence, client.bloc, client.appartement]
                );

                const gponPath = conn[0] ? `
- **Port GPON OLT** : Central OLT Port **${conn[0].port_olt || "GPON 01/03"}**
- **Hub FDT (Cabinet)** : **${conn[0].fdt || "UMA SOUKRA"}**
- **Boîtier PBO (BPI)** : **${conn[0].pos_bpi || "BPI-A7"}**
- **GPON Card / Slot** : **${conn[0].port_carte_gpon || "GPON-0"}**` : "\n*Aucun chemin de brassage GPON central configuré.*";

                let materialsStr = "";
                if (client.materials_used) {
                  try {
                    const parsed = JSON.parse(client.materials_used);
                    const allMats = await sqliteQuery("SELECT * FROM materials");
                    materialsStr = Object.entries(parsed)
                      .map(([matId, qty]: any) => {
                        if (qty <= 0) return null;
                        const matName = allMats.find(m => String(m.id) === String(matId))?.name || `Matériau ID ${matId}`;
                        return `- **${matName}** : Consommé x**${qty}**`;
                      })
                      .filter(Boolean)
                      .join("\n");
                  } catch (e) {}
                }
                if (!materialsStr) materialsStr = "*Aucun matériel déduit pour le moment (chantier en cours).*";

                if (isAr) {
                  reply = `🔍 **[بطاقة المشترك والتشخيص الذكي من مساعد الـ IA]**
  
فيما يلي المعلومات الفنية المباشرة المستخرجة من **ftth.db** للمشترك **${client.client_name}** :

- **العنوان** : مجمع ${client.residence}، ${client.bloc} - شقة ${client.appartement} (الطابق ${client.etage || "الأرضي"})
- **إحداثيات GPS** : \`${client.gps}\`
- **حالة التشغيل** : ${
                    client.status === "Pending" ? "🔵 **في الانتظار (جديد)**" :
                    client.status === "Dispatched" ? `🟡 **قيد التنفيذ ميدانياً (التقني المكلف: ${client.assigned_tech})**` :
                    client.status === "Completed" ? "🟢 **الربط نشط ومعتمد بنجاح**" :
                    client.status === "Fault" ? "🔴 **تم الإبلاغ عن عطل فني في الموقع**" : "غير معروف"
                  }
- **تاريخ التسجيل** : ${new Date(client.created_at).toLocaleString("ar-TN")}

⚡ **مسار الربط الضوئي GPON** :${conn[0] ? `
- **بورت OLT الرئيسي** : البوابة المركزية **${conn[0].port_olt || "GPON 01/03"}**
- **خزانة التوزيع (FDT)** : **${conn[0].fdt || "UMA SOUKRA"}**
- **صندوق التوزيع (PBO)** : **${conn[0].pos_bpi || "BPI-A7"}**
- **منفذ كرت الـ GPON** : **${conn[0].port_carte_gpon || "GPON-0"}**` : "\n*لا يوجد مسار GPON مركزي معد حالياً.*"}

🛠️ **المعدات المستهلكة في التركيب** :
${materialsStr}

📝 **ملاحظات وتقارير التقني** :
*"${client.notes || "لا توجد أي تقارير فنية مسجلة حالياً."}"*`;
                } else {
                  reply = `🔍 **[Fiche Client & Diagnostic Copilote IA]**
  
Voici les informations techniques en direct de **ftth.db** pour le client **${client.client_name}** :
 
- **Adresse** : Résidence ${client.residence}, ${client.bloc} - Appt ${client.appartement} (Et. ${client.etage || "RDC"})
- **Coordonnées GPS** : \`${client.gps}\`
- **Statut opérationnel** : ${
                    client.status === "Pending" ? "🔵 **En attente de raccordement (PM demand)**" :
                    client.status === "Dispatched" ? `🟡 **En cours terrain (Technicien affecté : ${client.assigned_tech})**` :
                    client.status === "Completed" ? "🟢 **Raccordement actif et validé**" :
                    client.status === "Fault" ? "🔴 **Incident optique déclaré sur site**" : "Grisé"
                  }
- **Date d'enregistrement** : ${new Date(client.created_at).toLocaleString("fr-FR")}
 
⚡ **Cheminement Optique GPON** :${gponPath}
 
🛠️ **Matériels d'ingénierie consommés** :
${materialsStr}
 
📝 **Rapport technique du Technicien SOTETEL** :
 *"${client.notes || "Aucun rapport n'a été rédigé pour le moment."}"*`;
                }
              } else {
                // Try querying connections
                const connResults = await sqliteQuery(
                  "SELECT * FROM connections WHERE residence LIKE ? OR pos_bpi LIKE ? LIMIT 3",
                  [`%${userMsg}%`, `%${userMsg}%`]
                );
                if (connResults.length > 0) {
                  const conn = connResults[0];
                  if (isAr) {
                    reply = `🔍 **[مسار الربط المحلّي GPON]**
  
تم العثور على معلومات الربط التالية في قاعدة البيانات :
- **المشترك** : مجمع ${conn.residence}، بلوك ${conn.bloc} - شقة ${conn.appartement}
- **خزانة التوزيع (FDT)** : **${conn.fdt}**
- **صندوق التوزيع (PBO)** : **${conn.pos_bpi}**
- **منفذ الـ OLT المركزي** : بوابة **${conn.port_olt}** (سنترال سكرة GPON)`;
                  } else {
                    reply = `🔍 **[Topologie GPON Locale]**
  
Voici l'élément de liaison optique trouvé dans la base :
- **Abonné** : Résidence ${conn.residence}, Bloc ${conn.bloc} - App ${conn.appartement}
- **Hub FDT** : Cabinet **${conn.fdt}**
- **Boîte PBO** : **${conn.pos_bpi}**
- **Port OLT Central** : Port **${conn.port_olt}** (GPON OLT centrale Soukra)`;
                  }
                } else {
                  if (isAr) {
                    reply = `مرحباً! لم أتمكن من العثور على أي مشترك أو ورشة عمل باسم **"${userMsg}"** في قاعدة البيانات.
  
جرب الاستعلام عن أسماء مثل **"Salma"** أو اكتب **"مخزون"**، **"إنذار"**، أو **"ورشات"** للحصول على تفاصيل فورية باللغة العربية!`;
                  } else {
                    reply = `Bonjour ! Je n'ai pas trouvé de fiche d'installation au nom de **"${userMsg}"** dans la base de données. 
 
Essayez de me demander des détails sur **"Salma Labidi"** ou tapez **"stock"**, **"alarmes"**, ou **"chantiers"** pour obtenir des extractions en direct !`;
                  }
                }
              }
            } else if (lower.includes("stock") || lower.includes("inventaire") || lower.includes("matériel") || lower.includes("مخزون") || lower.includes("مخازن") || lower.includes("قطع")) {
              const mats = await sqliteQuery("SELECT * FROM materials");
              const lowStock = mats.filter(m => m.stock_qty <= m.min_stock);
              
              if (isAr) {
                reply = `📦 **[مساعد الـ IA : حالة المخزون وقطع الغيار لشركة SOTETEL]**
  
قمت بفحص قاعدة بيانات المخازن SQLite. إليك ملخص حالة قطع الغيار والكبسولات حالياً :

- **إجمالي المواد المسجلة** : ${mats.length} فئة من المواد والمعدات الفنية.
- **تنبيهات نقص الكمية** : **${lowStock.length} مواد تحت حد الأمان**.

⚠️ **المواد التي وصلت للحد الحرج (تتطلب إعادة طلب فوراً)** :
${lowStock.map(m => `- **${m.name}** (رمز: \`${m.code}\`) : المتبقي **${m.stock_qty}** ${m.unit} (الحد الأدنى : ${m.min_stock})`).join("\n")}

💡 *يمكنك مراجعة الكميات وتأكيد طلبات التوريد من شاشة إدارة المخازن المركزية.*`;
              } else {
                reply = `📦 **[Copilote IA : État des Stocks & Catalogue SOTETEL]**
  
J'ai scanné le catalogue d'inventaire dans la base SQLite. Voici le résumé actuel :
 
- **Total articles référencés** : ${mats.length} types de matériels.
- **Ruptures / Seuil bas détectés** : **${lowStock.length} alertes actives**.
 
⚠️ **Articles en seuil critique (Alerte réapprovisionnement)** :
${lowStock.map(m => `- **${m.name}** (Code: \`${m.code}\`) : **${m.stock_qty}** ${m.unit} restants (Seuil min : ${m.min_stock})`).join("\n")}
 
💡 *Vous pouvez gérer les entrées/sorties et demander un réapprovisionnement depuis la page de gestion de l'Inventaire.*`;
              }
            } else if (lower.includes("alarmes") || lower.includes("anomalies") || lower.includes("panne") || lower.includes("coupure") || lower.includes("إنذار") || lower.includes("أعطال") || lower.includes("مشاكل")) {
              const activeAlarms = await sqliteQuery("SELECT * FROM alerts WHERE status != 'Resolved' ORDER BY id DESC");
              
              if (isAr) {
                reply = `🚨 **[مساعد الـ IA : تقرير الأعطال وتنبيهات شبكة GPON]**
  
إليك تفاصيل الأعطال والانقطاعات الضوئية النشطة في شبكة الـ FTTH حالياً :

- **إجمالي الأعطال النشطة** : **${activeAlarms.length} إنذارات انقطاع إشارة**.

🔴 **قائمة المشكلات الفنية غير المحلولة** :
${activeAlarms.map(a => `- **[${a.level}]** ${a.message} (صندوق التوزيع: \`${a.pos_bpi || "N/A"}\`) - *الحالة: ${a.status}* (التقني المكلف: ${a.assigned_tech || "غير معين"})`).join("\n")}

💡 *يتلقى الفنيون إشعارات هذه الأعطال فوراً للتوجه للموقع وإجراء فحص OTDR لتحديد مسافة الانقطاع بالدقة.*`;
              } else {
                reply = `🚨 **[Copilote IA : Bilan Supervision & Alarmes GPON]**
  
Voici la liste des anomalies actives non résolues sur le réseau FTTH :
 
- **Total alarmes en cours** : **${activeAlarms.length} coupures de signal**.
 
🔴 **Toutes les pannes actives** :
${activeAlarms.map(a => `- **[${a.level}]** ${a.message} (PBO/BPI : \`${a.pos_bpi || "N/A"}\`) - *Statut : ${a.status}* (Assigné : ${a.assigned_tech || "Non assigné"})`).join("\n")}
 
💡 *Les techniciens reçoivent ces alertes directement sur leur terminal pour investiguer à l'aide des traces OTDR.*`;
              }
            } else if (lower.includes("chantiers") || lower.includes("installations") || lower.includes("travaux") || lower.includes("ورشات") || lower.includes("تركيب") || lower.includes("أشغال")) {
              const insts = await sqliteQuery("SELECT * FROM installations ORDER BY id DESC");
              
              if (isAr) {
                reply = `🛠️ **[مساعد الـ IA : الحالة التشغيلية لورشات التوصيل]**
  
إليك تفاصيل تقدم تقدم أعمال رصف كابلات المشتركين الجدد :

- **في انتظار التكليف** : **${insts.filter(x => x.status === "Pending").length}**
- **قيد التنفيذ ميدانياً** : **${insts.filter(x => x.status === "Dispatched").length}**
- **مكتملة ومفعّلة** : **${insts.filter(x => x.status === "Completed").length}**
- **أعطال فنية بالموقع** : **${insts.filter(x => x.status === "Fault").length}**
- **ملغاة (رفض العميل)** : **${insts.filter(x => x.status === "Cancelled").length}**

👤 **الورشات قيد العمل الفعلي وتوزيع الفنيين** :
${insts.filter(x => x.status === "Dispatched").map(x => `- العميل **${x.client_name}** مكلف للتقني **${x.assigned_tech}**`).join("\n") || "*لا توجد أي ورشات قيد التنفيذ حالياً.*"}`;
              } else {
                reply = `🛠️ **[Copilote IA : Suivi Opérationnel des Chantiers]**
  
Voici le tableau d'avancement des installations d'abonnés enregistrées :
 
- **En attente d'affectation** : **${insts.filter(x => x.status === "Pending").length}**
- **Dispatched (En cours terrain)** : **${insts.filter(x => x.status === "Dispatched").length}**
- **Terminés avec succès** : **${insts.filter(x => x.status === "Completed").length}**
- **Panne / Bloqués** : **${insts.filter(x => x.status === "Fault").length}**
- **Annulés (Refus client)** : **${insts.filter(x => x.status === "Cancelled").length}**
 
👤 **Chantiers en cours par Technicien** :
${insts.filter(x => x.status === "Dispatched").map(x => `- Client **${x.client_name}** affecté à **${x.assigned_tech}**`).join("\n") || "*Aucun chantier en cours d'intervention.*"}`;
              }
            } else {
              if (isAr) {
                reply = `مرحباً بك! أنا المساعد الذكي لشبكة FiberTrack.
  
أنا متصل بقاعدة بيانات البنية التحتية البصرية لشركة SOTETEL (**ftth.db**) بشكل فوري ومباشر.

يمكنك أن تسألني باللغة العربية أو الفرنسية عن :
- 👤 معلومات مشترك أو ورشة تركيب (مثال: **"سلمى"** أو **"Salma"**)
- 📦 جرد المخازن وحالة المستودع (مثال: **"مخزون"** أو **"stock"**)
- 🚨 تنبيهات الأعطال وانقطاع كابلات الفايبر (مثال: **"أعطال"** أو **"alarmes"**)
- 🛠️ متابعة الفنيين والورشات قيد التنفيذ (مثال: **"ورشات"** أو **"chantiers"**)
- 📷 كما يمكنك سحب وإفلات صورة فنية لكابل أو موصل لتقييم انحنائه أو تلوثه بالرؤية الاصطناعية!`;
              } else {
                reply = `Bonjour ! Je suis le Copilote Intelligent de FiberTrack. 
 
Je suis directement connecté en temps réel à la base de données SQLite de votre infrastructure (**ftth.db**).
 
Vous pouvez me poser des questions sur :
- 👤 Un client ou une installation (ex: **"Salma Labidi"** ou **"Salma"**)
- 📦 L'état de l'inventaire et des stocks (ex: **"stock"**)
- 🚨 Les coupures et pannes actives sur le réseau (ex: **"alarmes"**)
- 🛠️ Le suivi d'affectation des chantiers terrain (ex: **"chantiers"**)
- 📷 Ou glissez-déposez une photo de jarretière ou connecteur pour l'analyser visuellement !`;
              }
            }
          } catch (dbErr: any) {
            reply = isAr
              ? `عذراً، حدث خطأ أثناء الاتصال بقاعدة بيانات SQLite: ${dbErr.message}`
              : `Désolé, une erreur est survenue lors de la lecture de la base de données SQLite : ${dbErr.message}`;
          }
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err: any) {
      toast.error(err.message);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `❌ Une erreur est survenue : ${err.message}. Veuillez vérifier votre configuration et vos connexions réseau.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-14 bottom-0 z-[1900] w-85 border-l border-[#e2e8f0] bg-white shadow-2xl flex flex-col overflow-hidden dark:bg-slate-950 dark:border-slate-800 animate-in slide-in-from-right duration-200">
      
      {/* Copilot Header */}
      <header className="flex h-12 items-center justify-between px-4 border-b border-[#e2e8f0] bg-slate-50 dark:bg-slate-900 dark:border-slate-800 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-primary animate-pulse" />
          <span className="text-xs font-bold text-foreground">Copilote FiberTrack IA</span>
          <span className="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
            {engine}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition"
            title="Configuration IA"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-slate-200 dark:hover:bg-slate-800 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main Area: Settings panel or Messages list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {showSettings ? (
          /* IA CONFIGURATION PANEL */
          <div className="space-y-4 animate-in fade-in-50 duration-150">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Paramètres de l'IA</h3>
            
            <div className="space-y-3 text-xs">
              <div>
                <label className="font-semibold text-muted-foreground block mb-1">Moteur LLM</label>
                <select
                  value={engine}
                  onChange={(e) => setEngine(e.target.value as Engine)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="mock">Simulateur FTTH (Pas de clé requis)</option>
                  <option value="gemini">Google Gemini API Direct</option>
                  <option value="openrouter">OpenRouter Cloud API</option>
                  <option value="lmstudio">LM Studio Local Server</option>
                </select>
              </div>

              {engine !== "mock" && engine !== "lmstudio" && (
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Clé API Secrète</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="password"
                      placeholder="e.g. AIzaSy..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="w-full rounded-xl border border-input bg-background pl-9 pr-3 py-2 outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1 block">Votre clé est stockée uniquement localement sur votre navigateur.</span>
                </div>
              )}

              {engine === "lmstudio" && (
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">URL Endpoint Serveur</label>
                  <input
                    placeholder="e.g. http://localhost:1234/v1"
                    value={endpoint}
                    onChange={(e) => setEndpoint(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              )}

              {engine !== "mock" && (
                <div>
                  <label className="font-semibold text-muted-foreground block mb-1">Identifiant Modèle</label>
                  <input
                    placeholder={engine === "gemini" ? "gemini-2.5-flash" : "e.g. google/gemini-2.5-flash"}
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                </div>
              )}

              <div className="flex gap-2 pt-3">
                <button
                  type="button"
                  onClick={saveSettings}
                  className="flex-1 rounded-xl bg-primary text-primary-foreground font-bold py-2 text-center shadow-md shadow-primary/10 hover:bg-primary/90 transition"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="flex-1 rounded-xl border border-border bg-card py-2 text-center hover:bg-accent text-slate-700 dark:text-slate-300 transition"
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* MESSAGES LIST PANEL */
          <div className="flex flex-col gap-3">
            {messages.map((m, index) => {
              const isAi = m.role === "assistant";
              return (
                <div
                  key={index}
                  className={`flex gap-2.5 max-w-[85%] ${isAi ? "self-start" : "self-end flex-row-reverse"}`}
                >
                  {/* Icon Avatar */}
                  <div
                    className={`flex h-6.5 w-6.5 shrink-0 select-none items-center justify-center rounded-full text-[10px] ${
                      isAi
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-200"
                    }`}
                  >
                    {isAi ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  
                  {/* Bubble content */}
                  <div
                    className={`rounded-2xl p-3 text-xs leading-relaxed shadow-xs ${
                      isAi
                        ? "bg-slate-50 border border-slate-100 text-slate-800 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {m.image && (
                      <div className="mb-2 overflow-hidden rounded-xl border border-black/10 dark:border-white/10 max-h-40">
                        <img src={m.image} alt="Diagnostic" className="w-full h-auto object-cover" />
                      </div>
                    )}
                    <div className="whitespace-pre-line">{m.content}</div>
                  </div>
                </div>
              );
            })}

            {loading && (
              <div className="flex gap-2.5 max-w-[85%] self-start animate-pulse">
                <div className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px]">
                  <Bot className="h-3.5 w-3.5" />
                </div>
                <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3 text-xs text-muted-foreground flex items-center gap-1.5 dark:bg-slate-900 dark:border-slate-800">
                  <Cpu className="h-3.5 w-3.5 animate-spin text-primary" />
                  Réflexion en cours…
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Image Preview Thumbnail */}
      {attachedImage && !showSettings && (
        <div className="px-3 py-2 border-t border-[#e2e8f0] dark:border-slate-800 bg-slate-100/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative h-10 w-10 rounded-lg overflow-hidden border border-border shrink-0 bg-white">
              <img src={attachedImage} alt="Attachment" className="h-full w-full object-cover" />
            </div>
            <div className="text-[10px] truncate max-w-[150px]">
              <div className="font-bold text-foreground truncate">{attachedImageName}</div>
              <div className="text-muted-foreground">Prêt pour diagnostic IA</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAttachedImage(null);
              setAttachedImageName(null);
            }}
            className="rounded-lg p-1 bg-slate-200 hover:bg-rose-100 hover:text-rose-600 transition dark:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Input Message Area */}
      {!showSettings && (
        <form onSubmit={handleSend} className="p-3 border-t border-[#e2e8f0] dark:border-slate-800 shrink-0 bg-slate-50 dark:bg-slate-950 flex gap-2 items-center">
          {/* File attachment hidden input */}
          <label className="rounded-xl border border-input bg-background p-2 text-muted-foreground hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-850 cursor-pointer transition shrink-0" title="Attacher une photo d'équipement pour diagnostic">
            <Paperclip className="h-3.5 w-3.5" />
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  setAttachedImage(reader.result as string);
                  setAttachedImageName(file.name);
                  toast.success("Photo fibre attachée !");
                };
                reader.readAsDataURL(file);
              }}
              className="hidden"
            />
          </label>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder={attachedImage ? "Décrivez le problème ou lancez le diagnostic…" : "Posez une question GPON…"}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={(!input.trim() && !attachedImage) || loading}
            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 p-2 shadow-md shadow-primary/10 disabled:opacity-50 disabled:cursor-not-allowed transition shrink-0"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </form>
      )}
    </div>
  );
}

# FiberTrack IQ Application Manual & Guide / دليل وكتيب تطبيق فايبير تراك آي كيو

Welcome to the official user manual and guide for **FiberTrack IQ**. This document is designed specifically for non-technical users and contains absolutely no complex programming jargon. 

مرحباً بكم في الدليل الرسمي وكتيب الاستخدام لتطبيق **فايبير تراك آي كيو (FiberTrack IQ)**. تم إعداد هذا المستند خصيصاً للمستخدمين غير التقنيين، وهو خالٍ تماماً من المصطلحات البرمجية المعقدة.

---

## 📌 Table of Contents / جدول المحتويات

1. [Project Overview & Concept / نظرة عامة وفكرة المشروع](#1-project-overview--concept--نظرة-عامة-وفكرة-المشروع)
2. [Technology Stack / المكونات التقنية للمشروع](#2-technology-stack--المكونات-التقنية-للمشروع)
3. [Running Guide / دليل التشغيل للمبتدئين](#3-running-guide--دليل-التشغيل-للمبتدئين)
4. [Project Folder Structure / هيكلة ملفات ومجلدات المشروع](#4-project-folder-structure--هيكلة-ملفات-ومجلدات-المشروع)
5. [Code Pages & Implementation / تفصيل صفحات ومكونات الكود](#5-code-pages--implementation--تفصيل-صفحات-ومكونات-الكود)
6. [Strategic Benefits, Challenges & Objectives / الفوائد، التحديات والأهداف الاستراتيجية](#6-strategic-benefits-challenges--objectives--الفوائد-التحديات-والأهداف-الاستراتيجية)
7. [Conclusion & Maintenance / خاتمة وإرشادات الصيانة المبسطة](#7-conclusion--maintenance--خاتمة-وإرشادات-الصيانة-المبسطة)

---

## 1. Project Overview & Concept / نظرة عامة وفكرة المشروع

### 🇬🇧 English
**FiberTrack IQ** is a modern, ultra-lightweight web application designed to help you supervise, manage, and monitor operations smoothly. Think of it as a **digital command center** that sits directly on your computer.

What makes **FiberTrack IQ** unique and powerful is its **database-free local approach**. In traditional applications, the software must constantly talk to a massive, expensive external computer in the cloud (called a "database server") to save and read information. If that external computer goes down or gets hacked, your app stops working.

**FiberTrack IQ** works differently:
* ⚡ **Ultra-Fast**: Because it runs entirely inside your web browser using your computer's built-in memory capabilities, there are no delays waiting for internet data from distant servers.
* 📦 **100% Portable**: You can copy the entire application onto a USB flash drive, plug it into any computer, and it will run instantly.
* 🔒 **Highly Secure**: Since there is no external database server connected to the internet, there is no door open for hackers to steal your information online. Your data stays safe on your own physical computer.

---

### 🇸🇦 العربية
تطبيق **فايبير تراك آي كيو (FiberTrack IQ)** هو تطبيق ويب حديث وخفيف الوزن للغاية، تم تصميمه لمساعدتكم في توجيه وإدارة ومراقبة العمليات والمهام بكل سلاسة وسهولة. يمكنكم تصوره كـ **مركز تحكم رقمي** يعمل مباشرة على جهاز الكمبيوتر الخاص بكم.

ما يجعل تطبيق **فايبير تراك آي كيو** فريداً وقوياً للغاية هو اعتماده على **منهجية التشغيل المحلي الخالي من قواعد البيانات الخارجية**. في التطبيقات التقليدية، يجب على البرنامج الاتصال باستمرار بجهاز كمبيوتر خارجي ضخم ومكلف في السحابة الإلكترونية (يسمى "خادم قاعدة البيانات") لحفظ وقراءة المعلومات. وإذا تعطل هذا الكمبيوتر الخارجي أو تعرض للاختراق، يتوقف تطبيقكم عن العمل تماماً.

لكن تطبيق **فايبير تراك آي كيو** يعمل بطريقة مختلفة كلياً:
* ⚡ **سريع للغاية**: لأنه يعمل بالكامل داخل متصفح الإنترنت الخاص بكم بالاعتماد على القدرات التخزينية المدمجة في جهازكم، مما يلغي أي انتظار أو تأخير لجلب البيانات عبر الإنترنت.
* 📦 **متنقل بنسبة 100%**: يمكنكم نسخ التطبيق بالكامل على ذاكرة فلاش (USB)، وتوصيلها بأي كمبيوتر آخر وتشغيله فوراً وبدون أي عوائق.
* 🔒 **آمن للغاية**: نظراً لعدم وجود خادم قاعدة بيانات خارجي متصل بالإنترنت، فلا توجد ثغرات أو "أبواب مفتوحة" تتيح للمخترقين استغلالها لسرقة معلوماتكم الحساسة عبر الشبكة. تبقى بياناتكم آمنة تماماً على جهازكم الشخصي المادي.

---

## 2. Technology Stack / المكونات التقنية للمشروع

### 🇬🇧 English
We built this application using a set of modern design tools. Below is an easy-to-understand explanation of what each tool does using simple everyday analogies:

| Technology | What it is | Simple Everyday Analogy (How it works) |
| :--- | :--- | :--- |
| **React.js** | The Core Engine | Like **Lego building blocks**. It allows us to build distinct parts of the screen (like buttons, lists, or forms) once and reuse them anywhere. |
| **Node.js** | The Engine Platform | Like a **desktop simulator**. It creates a secure local environment on your computer that lets the application run offline. |
| **Tailwind CSS** | The Paint & Style | Like the **paint, wallpaper, and interior design** of a house. It defines the colors, glowing borders, dark mode, and spacing. |
| **Lucide Icons** | The Visual Signs | Like **universal road signs**. They are clean, beautiful icons (like maps, bells, and gears) that guide your eyes across the screen. |

---

### 🇸🇦 العربية
لقد قمنا ببناء هذا التطبيق باستخدام مجموعة من الأدوات البرمجية الحديثة. نوضح لكم فيما يلي وظيفة كل أداة باستخدام تشبيهات مبسطة من الحياة اليومية لتسهيل فهمها:

| التقنية المستخدمة | ما هي؟ | التشبيه اليومي المبسط (كيف تعمل؟) |
| :--- | :--- | :--- |
| **React.js** | المحرك الأساسي للتطبيق | تشبه **مكعبات الليغو (Lego)**. تتيح لنا تصميم أجزاء الشاشة (مثل الأزرار، القوائم، أو النماذج) مرة واحدة وإعادة استخدامها في أي مكان آخر بسهولة. |
| **Node.js** | منصة تشغيل المحرك | تشبه **جهاز المحاكاة المنزلي**. توفر بيئة عمل محلية آمنة على جهاز الكمبيوتر الخاص بكم لتشغيل التطبيق دون الحاجة للاتصال بالإنترنت. |
| **Tailwind CSS** | أداة الطلاء والتصميم | تشبه **الطلاء، وورق الحائط، والتصميم الداخلي** للمنزل. تحدد الألوان، والحدود المتوهجة، والوضع الليلي، والمسافات بين العناصر. |
| **Lucide Icons** | الرموز البصرية الإرشادية | تشبه **لافتات المرور العالمية**. هي عبارة عن أيقونات ورموز واضحة وجميلة (مثل الخرائط، الأجراس، والتروس) ترشد العين أثناء التنقل في التطبيق. |

---

## 3. Running Guide / دليل التشغيل للمبتدئين

### 🇬🇧 English
Follow these four simple steps to set up and start the application on any standard computer:

#### **Step 1: Download & Install Node.js**
* **What it means**: Think of **Node.js** as a "simulator engine" that reads the code files and translates them so your personal computer can understand how to run them.
* **What to do**: Go to [nodejs.org](https://nodejs.org) in your web browser, download the **LTS (Recommended)** version for Windows or Mac, and click "Next" on the installer until it finishes.

#### **Step 2: Open the Terminal (Command Prompt)**
* **What it means**: The **Terminal** (or Command Prompt on Windows) is a text-based window where you can give simple commands to your computer.
* **What to do**:
  * **On Windows**: Press the `Windows Key` on your keyboard, type **cmd** or **Command Prompt**, and press Enter.
  * **On Mac**: Press `Command + Space`, type **Terminal**, and press Enter.
  * To enter your extracted code folder, type `cd ` followed by the path of the folder, then press Enter. E.g.:
    ```bash
    cd C:\Users\TOPIC\Desktop\ftth
    ```
    *(Analogy: `cd` stands for "change directory," which is like double-clicking a folder to go inside it).*

#### **Step 3: Run `npm install`**
* **What it means**: This command acts like a **smart shopping assistant**. It reads the blueprint of the application, reaches out to a secure library of free code building blocks, and downloads all the design templates needed for the app to look premium and operate.
* **What to do**: Inside the terminal window, type the following command and press Enter:
  ```bash
  npm install
  ```
  *(Wait 1-2 minutes until a success message appears. You only need to do this step once!)*

#### **Step 4: Run `npm run dev` & View the App**
* **What it means**: This command **turns on the engine ignition** of your application.
* **What to do**: In the same terminal window, type:
  ```bash
  npm run dev
  ```
  * Once the engine starts, it will show a local address like **`http://localhost:8080`**.
  * Simply highlight that link, copy it, open your favorite web browser (Google Chrome, Microsoft Edge, etc.), paste the link into the address bar, and press Enter to see your gorgeous application run!

---

### 🇸🇦 العربية
يرجى اتباع الخطوات الأربع البسيطة التالية لإعداد وتشغيل التطبيق على أي جهاز كمبيوتر عادي:

#### **الخطوة 1: تحميل وتثبيت برنامج Node.js**
* **المعنى المبسط**: تصوروا برنامج **Node.js** كـ "محرك محاكاة" يقوم بقراءة ملفات الكود وترجمتها حتى يستطيع جهاز الكمبيوتر الخاص بكم فهم كيفية تشغيلها.
* **طريقة العمل**: افتحوا موقع [nodejs.org](https://nodejs.org) في المتصفح، وقوموا بتحميل نسخة **LTS (النسخة المستقرة الموصى بها)** لنظام التشغيل الخاص بكم (ويندوز أو ماك)، ثم اضغطوا على "التالي" (Next) في معالج التثبيت حتى ينتهي تماماً.

#### **الخطوة 2: فتح موجه الأوامر (الترمينال - Terminal)**
* **المعنى المبسط**: **موجه الأوامر** (أو Command Prompt في ويندوز) هو عبارة عن نافذة نصية سوداء تتيح لكم إعطاء أوامر نصية مباشرة وبسيطة للكمبيوتر.
* **طريقة العمل**:
  * **على نظام ويندوز**: اضغطوا على زر `Windows` في لوحة المفاتيح، واكتبوا **cmd** أو **Command Prompt**، ثم اضغطوا Enter.
  * **على نظام ماك**: اضغطوا على مفتاحي `Command + Space` معاً واكتبوا **Terminal**، ثم اضغطوا Enter.
  * للدخول إلى مجلد الكود الخاص بالتطبيق، اكتبوا الأمر `cd ` يليه مسار المجلد، ثم اضغطوا Enter. مثال:
    ```bash
    cd C:\Users\TOPIC\Desktop\ftth
    ```
    *(توضيح: الأمر `cd` يعني "تغيير المجلد الحالي"، وهو تماماً كالنقر المزدوج على مجلد لفتحه والدخول إليه).*

#### **الخطوة 3: تشغيل أمر تثبيت الملفات `npm install`**
* **المعنى المبسط**: هذا الأمر يعمل كـ **مساعد تسوق ذكي**. يقوم بقراءة المخطط العام للتطبيق، ويتصل بكتبة برمجية آمنة لتحميل كافة قوالب التصميم وأدوات الشكل الجمالي التي يحتاجها التطبيق ليعمل بكامل طاقته ومظهره الفاخر.
* **طريقة العمل**: داخل نافذة موجه الأوامر، اكتبوا الأمر التالي واضغطوا Enter:
  ```bash
  npm install
  ```
  *(انتظروا دقيقة أو دقيقتين حتى يكتمل التنزيل. هذه الخطوة يتم القيام بها مرة واحدة فقط عند تشغيل التطبيق لأول مرة!)*

#### **الخطوة 4: تشغيل التطبيق `npm run dev` ومتابعته**
* **المعنى المبسط**: هذا الأمر يقوم بـ **تشغيل محرك السيارة** وإطلاق لوحة التحكم الخاصة بالتطبيق.
* **طريقة العمل**: في نفس نافذة موجه الأوامر, اكتبوا الأمر التالي واضغطوا Enter:
  ```bash
  npm run dev
  ```
  * بمجرد تشغيل المحرك، سيظهر لكم رابط محلي مثل **`http://localhost:8080`**.
  * ما عليكم سوى نسخ هذا الرابط، ولصقه في شريط العناوين بمتصفح الإنترنت المفضل لديكم (غوغل كروم، أو إيدج)، ثم الضغط على Enter لتشاهدوا التطبيق يعمل أمامكم بكل ألوانه وجماله!

---

## 4. Project Folder Structure / هيكلة ملفات ومجلدات المشروع

### 🇬🇧 English
Here is a simplified blueprint of the files inside your project directory, showing what each part represents:

```text
ftth/ (The main folder containing everything)
├── public/                <-- Storage for raw assets like logos, default pictures, and static icons.
├── src/                   <-- The main kitchen where the code is cooked and prepared.
│   ├── components/        <-- Small puzzle pieces (reusable buttons, sidebars, AI chat boxes).
│   ├── hooks/             <-- Intelligent logic memory (saves settings like your language or zone).
│   ├── integrations/      <-- Connecting wires that link the app to helper cloud utilities.
│   ├── lib/               <-- Standard helper toolkits (e.g. databases, SQLite script tools).
│   ├── routes/            <-- The master navigation system (defines what happens when you click links).
│   │   ├── _app.tsx       <-- The main frame layout (the navigation sidebar and top header bar).
│   │   ├── login.tsx      <-- The login portal where users select their profiles.
│   │   └── _app/          <-- The actual pages/screens:
│   │       ├── index.tsx  <-- The dashboard loaded with charts, diagnostic counters, and tech scores.
│   │       ├── clients.tsx <-- The premium connection management list.
│   │       └── map.tsx    <-- GPS map directions navigator.
│   ├── styles.css         <-- The master stylesheet containing colors, dark mode tokens, and animations.
│   └── main.jsx           <-- The main entry door hook that mounts the app to the web browser.
├── package.json           <-- The manifest blueprint listing the name, version, and tools used.
└── README.md              <-- This helper instruction manual.
```

---

### 🇸🇦 العربية
إليكم رسماً بيانياً مبسطاً يوضح هيكلية ومحتويات مجلد التطبيق، مع شرح مبسط للمهمة الأساسية لكل مجلد وملف:

```text
ftth/ (المجلد الرئيسي للتطبيق بالكامل)
├── public/                <-- مستودع الأصول الثابتة كالشعارات، الصور التوضيحية، والرموز البسيطة.
├── src/                   <-- "المطبخ الرئيسي" حيث يتم كتابة وتجهيز وتطوير الأكواد البرمجية.
│   ├── components/        <-- قطع البزل الصغيرة (الأزرار المعاد استخدامها، القوائم الجانبية، وصناديق الذكاء الاصطناعي).
│   ├── hooks/             <-- الذاكرة الذكية للتطبيق (تحفظ تفضيلاتكم كلغة الواجهة أو المنطقة المحددة).
│   ├── integrations/      <-- الأسلاك الموصلة التي تربط التطبيق بالخدمات السحابية المساعدة.
│   ├── lib/               <-- أدوات المساعدة الأساسية لتسريع العمليات الحسابية وقراءة قواعد البيانات.
│   ├── routes/            <-- نظام الملاحة الرئيسي (يحدد ما يعرض على الشاشة عند الضغط على الروابط).
│   │   ├── _app.tsx       <-- الإطار العام للتطبيق (القائمة الجانبية الملونة وشريط العنوان العلوي).
│   │   ├── login.tsx      <-- بوابة تسجيل الدخول حيث يختار المستخدمون حساباتهم.
│   │   └── _app/          <-- الشاشات والصفحات الفعلية للتطبيق:
│   │       ├── index.tsx  <-- لوحة التحكم الرئيسية المليئة بالرسوم البيانية وعدادات التشخيص وأداء الفنيين.
│   │       ├── clients.tsx <-- شاشة إدارة طلبات توصيل الألياف البصرية للعملاء الجدد.
│   │       └── map.tsx    <-- شاشة الخرائط وتوجيهات الملاحة الحية GPS لفنيي التركيب.
│   ├── styles.css         <-- الدفتر الرئيسي للألوان، والحدود المتوهجة، والوضع الليلي، والحركات الجمالية.
│   └── main.jsx           <-- البوابة الرئيسية التي تقوم بربط وتشغيل هذا الكود البرمجي بمتصفح الويب.
├── package.json           <-- وثيقة المخطط العام التي تسجل اسم التطبيق وإصداره وقائمة الأدوات المستعملة فيه.
└── README.md              <-- كتيب التعليمات المساعد الذي تقرؤونه الآن.
```

---

## 5. Code Pages & Implementation / تفصيل صفحات ومكونات الكود

### 🇬🇧 English
To give you a peek behind the scenes, here is what the active code pages are responsible for:

* **`main.jsx` (The Main Entrance Door)**:
  Think of this as the main entrance to a building. Its only job is to open up, connect to your web browser, and say: *"Please display our React application inside this browser window."*
* **`App.jsx` or `_app.tsx` (The Central Controller)**:
  This is the building’s **lobby receptionist**. It checks who you are (your role: Admin, Operator, Technician, or Project Manager). It makes sure you only enter the rooms (screens) you are allowed to see. It also displays the persistent layout—the gorgeous sidebar menu on the left and the language selector.
* **The `components` Folder (Small Puzzle Pieces)**:
  Instead of writing the code for a search box or a button 100 times, we write it once inside this folder. Examples include:
  * `AIAssistant.tsx`: The smart floating chat bubble that detects signal issues and answers in French or Arabic.
* **The `pages` or `_app` Folder (Full Rooms/Screens)**:
  These are the actual rooms inside the building. When you click "Dashboard," the receptionist loads the `index.tsx` screen. When you click "Localisation," it loads the `map.tsx` screen. Each file here contains the layout and code for that specific screen.

---

### 🇸🇦 العربية
لإعطائكم لمحة سريعة عما يجري خلف الكواليس، إليكم شرحاً مبسطاً لوظيفة ملفات الأكواد الرئيسية في التطبيق:

* **الملف `main.jsx` (الباب الرئيسي للدخول)**:
  يمكنكم تصوره كبوابة الدخول الرئيسية للمبنى. عمله الوحيد هو فتح الاتصال بمتصفح الإنترنت الخاص بكم وطلب عرض التطبيق على الشاشة فوراً.
* **الملف `App.jsx` أو `_app.tsx` (المراقب والموجه المركزي)**:
  يمثل **موظف الاستقبال في ردهة المبنى**. يتحقق من هويتكم ودوركم الفني (مدير، فني ميداني، مسؤول مستودع، أو رئيس مشروع). يتأكد من أنكم تدخلون الغرف (الشاشات) المسموح لكم برؤيتها فقط. كما يقوم بعرض الهيكل الثابت للتطبيق مثل القائمة الجانبية على اليسار ومحدد اللغة والمنطقة.
* **مجلد المكونات `components` (قطع البزل الصغيرة)**:
  بدلاً من كتابة كود صندوق البحث أو كود زر التشغيل 100 مرة، نقوم بتصميمه مرة واحدة داخل هذا المجلد كقطعة غيار جاهزة للتركيب في أي مكان. مثل:
  * الملف `AIAssistant.tsx`: وهو المساعد الذكي العائم الذي يحلل مشاكل الألياف البصرية ويجيبكم باللغتين العربية أو الفرنسية.
* **مجلد الصفحات `pages` أو `_app` (الغرف والشاشات الكاملة)**:
  هي الغرف الفعلية داخل المبنى. عند الضغط على "لوحة القيادة"، يقوم موظف الاستقبال بتحميل شاشة `index.tsx`. وعند الضغط على "الخريطة"، يتم تحميل شاشة `map.tsx`. يحتوي كل ملف هنا على كامل تفاصيل تلك الشاشة المحددة.

---

## 6. Strategic Benefits, Challenges & Objectives / الفوائد، التحديات والأهداف الاستراتيجية

### 🇬🇧 English
**FiberTrack IQ** delivers high-fidelity operations management and addresses daily telecom engineering challenges to achieve clear, strategic business objectives:

*   **Primary Benefits:**
    *   **Direct Field Operations Management:** Live technician performance tracker and chantiers dispatcher.
    *   **Advanced Optical Intelligence (GPON/OTDR):** Instantly trace and locate fiber ruptures through real-time SVG reflectometry charts instead of expensive dedicated equipment.
    *   **Bilingual AI Network Anomaly Detection:** Real-time AI signals analysis and multilingual diagnostic agent (French and Arabic).
*   **Operational Challenges Solved:**
    *   *Challenge:* High equipment deployment and optical signal failure delays. *Solution:* Immediate visual mapping of ONT Rx signal power levels and OLT ports distribution.
    *   *Challenge:* Coordination overhead between project managers and field technicians. *Solution:* Integrated live technician workloads and GPS routing navigator directly inside the app.
    *   *Challenge:* Hardware shortages and stock management discrepancies. *Solution:* Automated real-time local database warnings for low stock materials.
*   **Business Objectives & Strategic Exploitation:**
    *   **Maximize Technician Efficiency:** Use the leaderboard to optimize dispatching workloads and reward top field technicians.
    *   **Reduce Network Downtime:** Leverage the interactive impact analyzer (Virtual Topology Break) to identify affected apartments in seconds during trunk cuts.
    *   **Facilitate Instant Client Deliveries:** Since the app is completely self-contained and database-free, it can be deployed on a client's secure offline machine or local intranet with zero configuration overhead, providing immediate business value.

---

### 🇸🇦 العربية
يقدم نظام **فايبير تراك آي كيو (FiberTrack IQ)** حزمة متكاملة لإدارة العمليات الميدانية وتخطي التحديات اليومية لهندسة الاتصالات لتحقيق أهداف استراتيجية واضحة وملموسة:

*   **الفوائد والمزايا الرئيسية:**
    *   **إدارة فورية للعمليات الميدانية:** لوحة أداء تفاعلية للفنيين وتكليف تلقائي ذكي لورشات العمل والتركيب.
    *   **هندسة اتصالات بصرية متقدمة (GPON/OTDR):** محاكاة تفاعلية فورية ورسم فني لمسارات وهن الألياف باستخدام لوحات SVG بدلاً من الأجهزة المكلفة.
    *   **مساعد ذكي ثنائي اللغة لكشف الأعطال:** تحليل ذكي وفوري لمؤشرات الإشارة وصيانة المشتركين القائمين باللغتين العربية والفرنسية.
*   **التحديات التشغيلية التي يعالجها التطبيق:**
    *   *التحدي:* تأخر تتبع الأعطال ووهن الإشارة البصرية في الشبكة. *الحل:* إسقاط فوري لمستويات إرسال واستقبال مودم المشترك (ONT Rx) وتوزع منافذ الـ OLT.
    *   *التحدي:* صعوبة التنسيق بين رؤساء المشاريع والفرق الميدانية. *الحل:* نظام التوجيه الملاحي GPS وتقدير المسافات والمسارات المتحركة للفنيين بالميدان.
    *   *التحدي:* نقص جرد المعدات في المستودعات وتأخر طلبات الشراء. *الحل:* تنبيهات جرد وتنبؤ تلقائي فوري بنقص المواد الأساسية اعتماداً على قاعدة البيانات.
*   **الأهداف الاستراتيجية وكيفية الاستغلال الأمثل للتطبيق:**
    *   **رفع كفاءة الأطقم الفنية:** استخدام لوحة متصدرين حية لتحسين توزيع أعباء العمل ومكافأة الفنيين المنجزين للمهام.
    *   **تقليص فترات انقطاع الخدمة:** استغلال محاكي قطع الشبكة الافتراضي (Topology Break) لتحديد المشتركين المتأثرين في ثوانٍ أثناء انقطاع كابل التوزيع الرئيسي.
    *   **تسليم فوري وسلس للعملاء:** نظراً لكون التطبيق مستقلاً وخالياً من قواعد البيانات الخارجية، يمكن تنصيبه وتوريده لشبكة العميل الداخلية المغلقة (Intranet) بنقرة واحدة ودون الحاجة لضبط معقد أو اشتراكات شهرية مكلفة.

---

## 7. Conclusion & Maintenance / خاتمة وإرشادات الصيانة المبسطة

### 🇬🇧 English
By designing **FiberTrack IQ** around a lightweight, local client-side architecture, we have made it **incredibly simple to maintain**:
* 🧼 **Zero Database Headache**: Traditional apps crash when the online database server goes offline or fills up. In **FiberTrack IQ**, there is no server to configure, back up, or pay for. It works immediately, forever.
* 🛡️ **Hack-Proof**: Because the application stores database interactions securely inside the local file (`ftth.db`) or local session memory, there is no remote cloud entry point for cyberattacks. Your client details and records are completely safe from online database leaks.
* 💻 **Runs Anywhere**: Whether you are on Windows, macOS, or Linux, the app will execute perfectly as long as Node.js is installed.

Enjoy using **FiberTrack IQ**! It is built to keep your operations fast, simple, and secure.

---

### 🇸🇦 العربية
من خلال تصميم تطبيق **فايبير تراك آي كيو (FiberTrack IQ)** بالاعتماد على بنية برمجية محلية ذكية خفيفة الوزن، جعلنا عملية **الصيانة والتشغيل أسهل ما يكون**:
* 🧼 **وداعاً لمشاكل قواعد البيانات المعقدة**: التطبيقات العادية تتعطل عندما يتوقف خادم قاعدة البيانات عن العمل أو عندما تمتليء سعة التخزين. في تطبيقنا، لا يوجد خادم يحتاج إلى تهيئة أو نسخ احتياطي أو دفع اشتراكات شهرية له. التطبيق يعمل فوراً وإلى الأبد.
* 🛡️ **حصانة ضد الاختراقات**: نظراً لأن التطبيق يتعامل مع قاعدة البيانات محلياً داخل ملف (`ftth.db`) أو في ذاكرة الجلسة المحلية، فلا توجد نقطة وصول سحابية يمكن للمقرصنين استغلالها لسرقة معلوماتكم. بيانات عملائكم وسجلات تشغيلكم محصنة تماماً ضد التسريبات الرقمية.
* 💻 **يعمل في كل مكان**: سواء كنتم تستخدمون نظام تشغيل ويندوز، ماك، أو لينكس، فإن التطبيق سيعمل معكم بكفاءة تامة طالما تم تثبيت برنامج Node.js البسيط على الجهاز.

نتمنى لكم تجربة رائعة في استخدام **فايبير تراك آي كيو (FiberTrack IQ)**! لقد صممناه خصيصاً لتسريع عملياتكم وتبسيطها وحمايتها إلى أقصى حد.

/* ==========================================================================
   LaporFasilitas: script.js (Vanilla JavaScript, tanpa framework)

   Struktur file:
     1. KONFIGURASI
     2. DATA CONTOH (mock data)
     3. PENYIMPANAN SESI (sessionStorage)
     4. LAYANAN DATA / API  ← titik integrasi Express.js di masa depan
     5. UTILITAS
     6. KOMPONEN UI
     7. KONTROLER HALAMAN
     8. ROUTER & SHELL APLIKASI
     9. INISIALISASI

   Catatan integrasi backend:
   Seluruh akses data melewati fungsi di bagian 4 (getReports, getReportById,
   createReport, updateReportStatus, getDashboardStats, loginUser, registerUser,
   dst). Lapisan tampilan (bagian 6–8) TIDAK pernah membaca data mock secara
   langsung. Untuk terhubung ke server Express.js, cukup ganti isi fungsi-fungsi
   tersebut dengan fetch() sesuai komentar "TODO(API)", tanpa mengubah UI.
   ========================================================================== */
(function () {
  "use strict";

  /* ========================================================================
     1. KONFIGURASI
     ======================================================================== */
  const API_CONFIG = {
    // Setel ke false setelah backend Express.js tersedia dan fungsi di
    // bagian 4 sudah diganti dengan fetch().
    USE_MOCK: true,
    // TODO(API): alamat REST API Express.js di masa depan, mis. "https://api.laporfasilitas.id/api"
    BASE_URL: "http://localhost:3000/api",
    // Jeda buatan agar status "memuat" terlihat seperti permintaan jaringan.
    MOCK_LATENCY_MS: 500,
  };

  const STORAGE_KEYS = {
    reports: "lf_reports_v1",
    users: "lf_users_v1",
    session: "lf_session_v1",
    sidebarPinned: "lf_sidebar_pinned",
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const PHONE_RE = /^(\+62|62|0)8[0-9]{7,12}$/;
  const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
  const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

  /* ========================================================================
     2. DATA CONTOH (MOCK DATA)
     Struktur data dibuat konsisten dengan respons yang diharapkan dari backend.
     ======================================================================== */

  /** Kategori fasilitas. Backend dapat menyediakan endpoint GET /api/categories. */
  const CATEGORIES = [
    { id: "jalan", label: "Jalan & Trotoar", icon: "i-road" },
    { id: "lampu", label: "Lampu Jalan", icon: "i-lamp" },
    { id: "gedung", label: "Gedung Publik", icon: "i-building" },
    { id: "drainase", label: "Drainase & Saluran Air", icon: "i-waves" },
    { id: "taman", label: "Taman & Ruang Terbuka", icon: "i-tree" },
    { id: "lainnya", label: "Fasilitas Lainnya", icon: "i-wrench" },
  ];

  /** Status laporan, berurutan sesuai alur penanganan. */
  const STATUSES = {
    baru: {
      id: "baru",
      label: "Baru",
      icon: "i-alert",
      tone: "var(--baru)",
      description: "Laporan telah diterima sistem dan sedang menunggu verifikasi oleh petugas.",
    },
    proses: {
      id: "proses",
      label: "Dalam Proses",
      icon: "i-clock",
      tone: "var(--accent-600)",
      description: "Laporan sudah diverifikasi dan sedang ditangani oleh dinas atau petugas terkait.",
    },
    selesai: {
      id: "selesai",
      label: "Selesai",
      icon: "i-check-circle",
      tone: "var(--selesai)",
      description: "Perbaikan telah rampung dan hasilnya sudah diverifikasi oleh petugas lapangan.",
    },
  };
  const STATUS_ORDER = ["baru", "proses", "selesai"];

  const DEFAULT_STATUS_NOTES = {
    baru: "Laporan diterima oleh sistem.",
    proses: "Laporan diverifikasi dan diteruskan ke dinas terkait untuk penanganan.",
    selesai: "Perbaikan telah selesai dan diverifikasi oleh petugas lapangan.",
  };

  /** URL foto contoh (Unsplash). */
  const unsplash = (id, w = 960) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=70`;

  /** Tanggal relatif terhadap hari ini agar data contoh selalu terlihat baru. */
  function daysAgo(days, hour = 9, minute = 0) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  }

  function buildHistory(status, createdDays) {
    const history = [{ status: "baru", date: daysAgo(createdDays, 8, 30), note: DEFAULT_STATUS_NOTES.baru }];
    if (status !== "baru") {
      history.push({ status: "proses", date: daysAgo(Math.max(createdDays - 1, 0), 13, 15), note: DEFAULT_STATUS_NOTES.proses });
    }
    if (status === "selesai") {
      history.push({ status: "selesai", date: daysAgo(Math.max(createdDays - 6, 0), 16, 0), note: DEFAULT_STATUS_NOTES.selesai });
    }
    return history;
  }

  function seedReport(seq, data) {
    const history = buildHistory(data.status, data.days);
    return {
      id: `LF-${String(seq).padStart(5, "0")}`,
      title: data.title,
      description: data.description,
      category: data.category,
      location: data.location,
      photoUrl: unsplash(data.photo),
      createdAt: history[0].date,
      updatedAt: history[history.length - 1].date,
      status: data.status,
      reporterId: data.reporterId,
      reporterName: data.reporterName,
      isPublic: true,
      history,
    };
  }

  const MOCK_USERS = [
    {
      id: "u-001",
      fullName: "Rina Wulandari",
      email: "warga@laporfasilitas.id",
      // CATATAN: kata sandi teks biasa HANYA untuk demo. Backend wajib melakukan hashing.
      password: "demo123",
      phone: "081234567890",
      city: "Kota Bandung",
      avatarUrl: "https://images.unsplash.com/photo-1550546094-9835463f9f71?auto=format&fit=crop&crop=faces&w=240&h=240&q=70",
      joinedAt: daysAgo(240),
      role: "warga",
    },
    { id: "u-002", fullName: "Budi Santoso", email: "budi@contoh.id", password: "demo123", phone: "", city: "Kota Surabaya", avatarUrl: null, joinedAt: daysAgo(180), role: "warga" },
    { id: "u-003", fullName: "Siti Aminah", email: "siti@contoh.id", password: "demo123", phone: "", city: "Jakarta Pusat", avatarUrl: null, joinedAt: daysAgo(120), role: "warga" },
    { id: "u-004", fullName: "Andi Pratama", email: "andi@contoh.id", password: "demo123", phone: "", city: "Kota Medan", avatarUrl: null, joinedAt: daysAgo(90), role: "warga" },
  ];

  const NAMES = { "u-001": "Rina Wulandari", "u-002": "Budi Santoso", "u-003": "Siti Aminah", "u-004": "Andi Pratama" };
  const by = (id) => ({ reporterId: id, reporterName: NAMES[id] });

  const MOCK_REPORTS = [
    seedReport(101, {
      title: "Jalan berlubang besar di depan SDN Sukajadi 03",
      description:
        "Terdapat lubang dengan diameter sekitar 1 meter dan kedalaman 15 cm tepat di depan gerbang sekolah. Saat hujan lubang tertutup genangan sehingga tidak terlihat dan sudah dua kali menyebabkan pengendara motor terjatuh.",
      category: "jalan",
      location: "Jl. Sukajadi No. 112, Kel. Sukagalih, Kec. Sukajadi, Kota Bandung",
      photo: "1635068741358-ab1b9813623f",
      status: "baru",
      days: 2,
      ...by("u-001"),
    }),
    seedReport(102, {
      title: "Aspal retak dan amblas di jalur kendaraan roda dua",
      description:
        "Permukaan aspal retak memanjang sekitar 20 meter dan sebagian amblas. Kendaraan roda dua harus berpindah ke jalur tengah sehingga membahayakan, terutama pada jam sibuk pagi hari.",
      category: "jalan",
      location: "Jl. Raya Darmo (depan Taman Bungkul), Kec. Wonokromo, Kota Surabaya",
      photo: "1784548789954-655c9a9e1a64",
      status: "proses",
      days: 9,
      ...by("u-002"),
    }),
    seedReport(103, {
      title: "Paving trotoar rusak membahayakan pejalan kaki",
      description:
        "Paving block trotoar banyak yang lepas dan tidak rata sepanjang kurang lebih 30 meter. Pejalan kaki, terutama lansia dan pengguna kursi roda, kesulitan melintas dan terpaksa berjalan di badan jalan.",
      category: "jalan",
      location: "Jl. Malioboro (dekat Pasar Beringharjo), Kec. Gondomanan, Kota Yogyakarta",
      photo: "1779179015285-120aaa822b1b",
      status: "selesai",
      days: 15,
      ...by("u-003"),
    }),
    seedReport(104, {
      title: "Genangan air permanen akibat permukaan jalan turun",
      description:
        "Permukaan jalan turun sehingga air hujan menggenang hingga berhari-hari. Genangan menyebabkan aspal di sekitarnya mulai terkelupas dan menimbulkan bau tidak sedap.",
      category: "jalan",
      location: "Jl. Pemuda No. 45, Kec. Semarang Tengah, Kota Semarang",
      photo: "1709934730506-fba12664d4e4",
      status: "baru",
      days: 4,
      ...by("u-002"),
    }),
    seedReport(105, {
      title: "Lampu jalan padam sepanjang 200 meter",
      description:
        "Lima tiang lampu penerangan jalan padam sejak dua minggu terakhir. Kawasan menjadi sangat gelap pada malam hari dan warga khawatir terhadap keamanan serta risiko kecelakaan.",
      category: "lampu",
      location: "Jl. Ir. H. Juanda (Simpang Dago–Cigadung), Kec. Coblong, Kota Bandung",
      photo: "1566276423184-a8c13d2a88a1",
      status: "proses",
      days: 6,
      ...by("u-001"),
    }),
    seedReport(106, {
      title: "Tiang lampu penerangan berkedip dan percikan listrik",
      description:
        "Lampu penerangan berkedip terus-menerus dan terlihat percikan listrik pada kotak panel di bawah tiang. Kondisi ini berbahaya bagi pejalan kaki dan anak-anak yang sering bermain di sekitar lokasi.",
      category: "lampu",
      location: "Jl. Gatot Subroto Km 3, Kec. Medan Petisah, Kota Medan",
      photo: "1495709165577-351d14380bdd",
      status: "selesai",
      days: 22,
      ...by("u-004"),
    }),
    seedReport(107, {
      title: "Saluran air tersumbat sampah dan menimbulkan bau",
      description:
        "Saluran air di gang permukiman tersumbat sampah plastik dan lumpur. Air tidak mengalir, menimbulkan bau menyengat, dan menjadi sarang nyamuk. Warga khawatir akan risiko demam berdarah.",
      category: "drainase",
      location: "Gg. Mawar RT 04/RW 07, Kel. Cempaka Putih Timur, Jakarta Pusat",
      photo: "1740484708120-86a447d6ca6c",
      status: "baru",
      days: 1,
      ...by("u-003"),
    }),
    seedReport(108, {
      title: "Banjir setinggi 30 cm setiap hujan deras",
      description:
        "Setiap hujan deras lebih dari satu jam, ruas jalan tergenang hingga 30 cm karena saluran drainase tidak mampu menampung debit air. Kendaraan sering mogok dan aktivitas warga terganggu.",
      category: "drainase",
      location: "Jl. Kemang Raya No. 8, Kec. Mampang Prapatan, Jakarta Selatan",
      photo: "1762624785174-a97cb4fa18f1",
      status: "proses",
      days: 11,
      ...by("u-001"),
    }),
    seedReport(109, {
      title: "Gorong-gorong penuh sampah di depan pasar",
      description:
        "Gorong-gorong di depan pintu masuk pasar dipenuhi sampah dan sisa dedaunan. Air meluap ke jalan saat hujan dan menyebabkan area pasar becek serta licin.",
      category: "drainase",
      location: "Jl. Pasar Baru Timur, Kec. Sawah Besar, Jakarta Pusat",
      photo: "1790798343899-28dc9b556ae3",
      status: "selesai",
      days: 30,
      ...by("u-002"),
    }),
    seedReport(110, {
      title: "Bangku taman patah dan papan kayu terlepas",
      description:
        "Dua bangku taman di area jogging track patah pada bagian sandaran dan beberapa papan kayu terlepas dengan paku mencuat. Berisiko melukai pengunjung, terutama anak-anak.",
      category: "taman",
      location: "Taman Lansia, Jl. Cisangkuy, Kec. Bandung Wetan, Kota Bandung",
      photo: "1690253525298-d35a3afb0f40",
      status: "baru",
      days: 3,
      ...by("u-004"),
    }),
    seedReport(111, {
      title: "Rantai ayunan taman bermain berkarat dan aus",
      description:
        "Rantai pada tiga ayunan di area bermain anak sudah berkarat dan terlihat aus di bagian sambungan. Dikhawatirkan putus saat digunakan. Perlu penggantian segera.",
      category: "taman",
      location: "Taman Suropati, Jl. Taman Suropati, Kec. Menteng, Jakarta Pusat",
      photo: "1690674216618-9711f673f51a",
      status: "proses",
      days: 13,
      ...by("u-003"),
    }),
    seedReport(112, {
      title: "Retakan dinding di ruang tunggu Puskesmas",
      description:
        "Muncul retakan panjang di dinding ruang tunggu pasien, dari langit-langit hingga lantai. Retakan semakin lebar setelah hujan deras dan pengunjung merasa khawatir dengan keamanan bangunan.",
      category: "gedung",
      location: "Puskesmas Kel. Lebak Bulus, Jl. Lebak Bulus Raya, Jakarta Selatan",
      photo: "1694415847950-973e7dcca94d",
      status: "selesai",
      days: 40,
      ...by("u-001"),
    }),
    seedReport(113, {
      title: "Toilet umum terminal rusak dan tidak berfungsi",
      description:
        "Tiga dari lima bilik toilet umum tidak dapat digunakan karena keran rusak dan saluran pembuangan mampet. Antrean panjang terjadi pada jam sibuk dan kebersihan area menurun.",
      category: "gedung",
      location: "Terminal Purabaya, Bungurasih, Kec. Waru, Kab. Sidoarjo",
      photo: "1776142519813-6a94ca6aa065",
      status: "proses",
      days: 5,
      ...by("u-002"),
    }),
    seedReport(114, {
      title: "Pagar pembatas jembatan berkarat dan berlubang",
      description:
        "Pagar besi pembatas di sisi jembatan berkarat parah dan beberapa bagian berlubang. Pagar menjadi rapuh sehingga membahayakan pejalan kaki yang bersandar atau anak-anak yang melintas.",
      category: "lainnya",
      location: "Jembatan Kali Code, Jl. Jenderal Sudirman, Kota Yogyakarta",
      photo: "1783414199246-0d653a659c1b",
      status: "baru",
      days: 8,
      ...by("u-003"),
    }),
  ];

  /* ========================================================================
     3. PENYIMPANAN SESI
     Data demo disimpan di sessionStorage: bertahan saat halaman dimuat ulang,
     hilang saat tab ditutup. Jika penyimpanan gagal (kuota penuh/diblokir),
     aplikasi tetap berjalan dengan data di memori.
     ======================================================================== */
  const storage = {
    memoryOnly: false,
    warned: false,
    read(key, fallback) {
      try {
        const raw = window.sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
      } catch (_) {
        return fallback;
      }
    },
    write(key, value) {
      if (this.memoryOnly) return false;
      try {
        window.sessionStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (_) {
        this.memoryOnly = true;
        if (!this.warned) {
          this.warned = true;
          // Ditunda agar toast tampil setelah aksi pengguna selesai.
          setTimeout(() => showToast("Penyimpanan sesi browser tidak tersedia. Data baru hanya tersimpan sampai halaman dimuat ulang.", "warning"), 400);
        }
        return false;
      }
    },
    remove(key) {
      try {
        window.sessionStorage.removeItem(key);
      } catch (_) {
        /* abaikan */
      }
    },
  };

  /** "Database" lokal untuk mode demo. */
  const db = { reports: [], users: [], session: null };

  function loadState() {
    db.reports = storage.read(STORAGE_KEYS.reports, null) || clone(MOCK_REPORTS);
    db.users = storage.read(STORAGE_KEYS.users, null) || clone(MOCK_USERS);
    db.session = storage.read(STORAGE_KEYS.session, null);
    if (db.session && !db.users.some((u) => u.id === db.session.userId)) db.session = null;
  }
  const persistReports = () => storage.write(STORAGE_KEYS.reports, db.reports);
  const persistUsers = () => storage.write(STORAGE_KEYS.users, db.users);
  const persistSession = () => (db.session ? storage.write(STORAGE_KEYS.session, db.session) : storage.remove(STORAGE_KEYS.session));

  /* ========================================================================
     4. LAYANAN DATA / API
     Semua fungsi bersifat async dan mengembalikan data biasa (plain object),
     sama seperti hasil res.json() dari backend nanti.
     ======================================================================== */

  class ApiError extends Error {
    constructor(message, status = 400, fields = null) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.fields = fields; // { namaField: "pesan" } untuk validasi per kolom
    }
  }

  const mockDelay = (ms = API_CONFIG.MOCK_LATENCY_MS) => new Promise((resolve) => setTimeout(resolve, ms));

  /*
   * Contoh helper untuk integrasi nanti (belum dipakai di mode mock):
   *
   * function authHeaders() {
   *   return db.session ? { Authorization: `Bearer ${db.session.token}` } : {};
   * }
   * async function request(path, options = {}) {
   *   const res = await fetch(`${API_CONFIG.BASE_URL}${path}`, {
   *     ...options,
   *     headers: { ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...authHeaders(), ...options.headers },
   *     credentials: "include",
   *   });
   *   const data = await res.json().catch(() => ({}));
   *   if (!res.ok) throw new ApiError(data.message || "Terjadi kesalahan pada server.", res.status, data.fields);
   *   return data;
   * }
   */

  function requireSession() {
    const user = getSessionUser();
    if (!user) throw new ApiError("Sesi Anda telah berakhir. Silakan masuk kembali.", 401);
    return user;
  }

  /**
   * Mengambil daftar laporan publik.
   * @param {{search?:string, category?:string, status?:string, reporterId?:string}} criteria
   */
  async function getReports(criteria = {}) {
    // TODO(API): ganti blok mock di bawah dengan:
    //   const params = new URLSearchParams(Object.entries(criteria).filter(([, v]) => v));
    //   return request(`/reports?${params}`);            // GET /api/reports → Report[]
    await mockDelay();
    return clone(filterReports(sortByNewest(db.reports), criteria));
  }

  /** Mengambil satu laporan berdasarkan ID. */
  async function getReportById(id) {
    // TODO(API): return request(`/reports/${encodeURIComponent(id)}`);   // GET /api/reports/:id
    await mockDelay(300);
    const report = db.reports.find((r) => r.id === id);
    if (!report) throw new ApiError("Laporan tidak ditemukan atau telah dihapus.", 404);
    return clone(report);
  }

  /** Mengambil laporan milik pengguna yang sedang masuk. */
  async function getMyReports(criteria = {}) {
    // TODO(API): return request(`/users/me/reports`);   // GET /api/users/me/reports
    const user = requireSession();
    await mockDelay();
    return clone(filterReports(sortByNewest(db.reports), { ...criteria, reporterId: user.id }));
  }

  /**
   * Membuat laporan baru.
   * @param {{title:string, category:string, description:string, location:string, photo:File}} reportData
   */
  async function createReport(reportData) {
    // TODO(API): kirim sebagai multipart/form-data agar foto diunggah ke server:
    //   const body = new FormData();
    //   Object.entries(reportData).forEach(([k, v]) => body.append(k, v));
    //   return request("/reports", { method: "POST", body });   // POST /api/reports → Report
    //   (Server yang membuat id, createdAt, status awal "baru", dan photoUrl.)
    const user = requireSession();
    const errors = validateReportPayload(reportData);
    if (errors) throw new ApiError("Data laporan belum lengkap.", 422, errors);

    // Mode demo: foto dikompres lalu disimpan sebagai data URL di sesi browser.
    const photoUrl = await compressImage(reportData.photo);
    await mockDelay(800);

    const now = new Date().toISOString();
    const report = {
      id: generateReportId(),
      title: reportData.title.trim(),
      description: reportData.description.trim(),
      category: reportData.category,
      location: reportData.location.trim(),
      photoUrl,
      createdAt: now,
      updatedAt: now,
      status: "baru",
      reporterId: user.id,
      reporterName: user.fullName,
      isPublic: true,
      history: [{ status: "baru", date: now, note: DEFAULT_STATUS_NOTES.baru }],
    };
    db.reports.unshift(report);
    persistReports();
    return clone(report);
  }

  /** Validasi sisi "server" untuk mode demo (backend harus memvalidasi ulang). */
  function validateReportPayload(data) {
    const errors = {};
    if (!data.title || data.title.trim().length < 10) errors.title = "Judul minimal 10 karakter.";
    if (!CATEGORIES.some((c) => c.id === data.category)) errors.category = "Kategori tidak valid.";
    if (!data.description || data.description.trim().length < 30) errors.description = "Deskripsi minimal 30 karakter.";
    if (!data.location || data.location.trim().length < 10) errors.location = "Lokasi terlalu singkat.";
    if (!data.photo) errors.photo = "Foto wajib diunggah.";
    return Object.keys(errors).length ? errors : null;
  }

  /**
   * Memperbarui status laporan (di sistem nyata hanya untuk petugas/admin).
   * @param {string} id @param {"baru"|"proses"|"selesai"} status @param {string} [note]
   */
  async function updateReportStatus(id, status, note = "") {
    // TODO(API): return request(`/reports/${encodeURIComponent(id)}/status`, {
    //   method: "PATCH", body: JSON.stringify({ status, note }) });   // PATCH /api/reports/:id/status
    requireSession();
    if (!STATUSES[status]) throw new ApiError("Status tidak valid.", 422);
    await mockDelay(450);
    const report = db.reports.find((r) => r.id === id);
    if (!report) throw new ApiError("Laporan tidak ditemukan.", 404);
    const now = new Date().toISOString();
    report.status = status;
    report.updatedAt = now;
    report.history.push({ status, date: now, note: note.trim() || DEFAULT_STATUS_NOTES[status] });
    persistReports();
    return clone(report);
  }

  /** Menghitung statistik dari dataset laporan yang sama (fungsi murni). */
  function calculateStats(reports) {
    const stats = { total: reports.length, baru: 0, proses: 0, selesai: 0, belumSelesai: 0 };
    reports.forEach((r) => {
      if (stats[r.status] !== undefined) stats[r.status] += 1;
    });
    stats.belumSelesai = stats.baru + stats.proses;
    return stats;
  }

  /** Statistik dashboard & landing page. */
  async function getDashboardStats() {
    // TODO(API): return request("/reports/stats");   // GET /api/reports/stats → { total, baru, proses, selesai, belumSelesai }
    await mockDelay();
    return calculateStats(db.reports);
  }

  /** Simulasi login. */
  async function loginUser(credentials) {
    // TODO(API): const data = await request("/auth/login", { method: "POST", body: JSON.stringify(credentials) });
    //   // POST /api/auth/login → { token, user }  (atau cookie HttpOnly dari Express)
    //   db.session = { token: data.token, userId: data.user.id }; persistSession(); return data;
    await mockDelay(700);
    const email = String(credentials.email || "").trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === email);
    if (!user) throw new ApiError("Email belum terdaftar. Silakan daftar terlebih dahulu.", 404, { email: "Email belum terdaftar." });
    if (user.password !== credentials.password) throw new ApiError("Email atau kata sandi yang Anda masukkan salah.", 401);
    db.session = { token: `mock-token-${Math.random().toString(36).slice(2)}`, userId: user.id };
    persistSession();
    return { token: db.session.token, user: publicUser(user) };
  }

  /** Simulasi pendaftaran akun (otomatis masuk setelah berhasil). */
  async function registerUser(userData) {
    // TODO(API): return request("/auth/register", { method: "POST", body: JSON.stringify(userData) });
    //   // POST /api/auth/register → { token, user }
    await mockDelay(800);
    const email = String(userData.email || "").trim().toLowerCase();
    if (db.users.some((u) => u.email.toLowerCase() === email)) {
      throw new ApiError("Email sudah terdaftar. Silakan masuk menggunakan email tersebut.", 409, { email: "Email sudah terdaftar." });
    }
    const user = {
      id: `u-${Date.now().toString(36)}`,
      fullName: userData.fullName.trim(),
      email,
      password: userData.password, // demo saja
      phone: normalizePhone(userData.phone || ""),
      city: "",
      avatarUrl: null,
      joinedAt: new Date().toISOString(),
      role: "warga",
    };
    db.users.push(user);
    persistUsers();
    db.session = { token: `mock-token-${Math.random().toString(36).slice(2)}`, userId: user.id };
    persistSession();
    return { token: db.session.token, user: publicUser(user) };
  }

  /** Keluar dari akun. */
  async function logoutUser() {
    // TODO(API): await request("/auth/logout", { method: "POST" });   // POST /api/auth/logout
    await mockDelay(250);
    db.session = null;
    persistSession();
  }

  /** Pengguna aktif (sinkron, untuk pengecekan rute). */
  function getSessionUser() {
    if (!db.session) return null;
    const user = db.users.find((u) => u.id === db.session.userId);
    return user ? publicUser(user) : null;
  }

  /** Profil pengguna aktif. */
  async function getCurrentUser() {
    // TODO(API): return request("/auth/me");   // GET /api/auth/me → User
    await mockDelay(200);
    return requireSession();
  }

  /** Memperbarui profil pengguna aktif. */
  async function updateUserProfile(data) {
    // TODO(API): return request("/users/me", { method: "PUT", body: JSON.stringify(data) });   // PUT /api/users/me
    const current = requireSession();
    await mockDelay(600);
    const user = db.users.find((u) => u.id === current.id);
    user.fullName = data.fullName.trim();
    user.phone = normalizePhone(data.phone || "");
    user.city = (data.city || "").trim();
    // Nama pelapor pada laporan ikut diperbarui (di backend biasanya lewat relasi).
    db.reports.forEach((r) => {
      if (r.reporterId === user.id) r.reporterName = user.fullName;
    });
    persistUsers();
    persistReports();
    return publicUser(user);
  }

  function publicUser(user) {
    const { password, ...rest } = user; // eslint-disable-line no-unused-vars
    return clone(rest);
  }

  /** Filter laporan berdasarkan pencarian, kategori, status, dan pelapor (fungsi murni). */
  function filterReports(reports, criteria = {}) {
    const terms = normalizeText(criteria.search || "")
      .split(/\s+/)
      .filter(Boolean);
    return reports.filter((r) => {
      if (criteria.status && r.status !== criteria.status) return false;
      if (criteria.category && r.category !== criteria.category) return false;
      if (criteria.reporterId && r.reporterId !== criteria.reporterId) return false;
      if (terms.length) {
        const haystack = normalizeText([r.title, r.location, r.description, getCategory(r.category).label, r.id].join(" "));
        return terms.every((t) => haystack.includes(t));
      }
      return true;
    });
  }

  const sortByNewest = (reports) => [...reports].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function generateReportId() {
    const max = db.reports.reduce((m, r) => Math.max(m, parseInt(String(r.id).replace(/\D/g, ""), 10) || 0), 100);
    return `LF-${String(max + 1).padStart(5, "0")}`;
  }

  /* ========================================================================
     5. UTILITAS
     ======================================================================== */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function escapeHTML(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function normalizeText(value) {
    return String(value)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const normalizePhone = (v) => String(v).replace(/[\s-]/g, "");

  const dateFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" });
  const dateLongFmt = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const dateTimeFmt = new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  const formatDate = (iso) => dateFmt.format(new Date(iso));
  const formatDateLong = (iso) => dateLongFmt.format(new Date(iso));
  const formatDateTime = (iso) => dateTimeFmt.format(new Date(iso)).replace(/\./g, ":");

  function formatRelative(iso) {
    const rtf = new Intl.RelativeTimeFormat("id", { numeric: "auto" });
    const diffSec = Math.round((new Date(iso) - Date.now()) / 1000);
    const abs = Math.abs(diffSec);
    if (abs < 60) return "baru saja";
    if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
    if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
    if (abs < 86400 * 30) return rtf.format(Math.round(diffSec / 86400), "day");
    return formatDate(iso);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
  }

  function debounce(fn, wait = 200) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), wait);
    };
  }

  const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "Warga";
  const initials = (name) =>
    String(name || "?")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0])
      .join("")
      .toUpperCase();
  const shortLocation = (loc) => String(loc).split(",").pop().trim();
  const getCategory = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

  /** Kompres gambar ke JPEG (maks. sisi terpanjang `maxSide` px) dan kembalikan data URL. */
  function compressImage(file, maxSide = 1280, quality = 0.78) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new ApiError("Foto tidak dapat diproses. Coba gunakan file gambar lain."));
      };
      img.src = url;
    });
  }

  /** Gambar cadangan bila foto gagal dimuat. */
  const PLACEHOLDER_IMG =
    "data:image/svg+xml," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250"><rect width="400" height="250" fill="#eef1f6"/><g fill="none" stroke="#94a0b4" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" transform="translate(164 89)"><rect x="0" y="0" width="72" height="72" rx="10"/><circle cx="24" cy="24" r="7"/><path d="m72 50-14-14a8 8 0 0 0-11 0L8 72"/></g></svg>`
    );

  function animateCount(el, to) {
    const target = Number(to) || 0;
    if (prefersReducedMotion() || target === 0) {
      el.textContent = target.toLocaleString("id-ID");
      return;
    }
    const start = performance.now();
    const duration = 900;
    const step = (now) => {
      const p = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * eased).toLocaleString("id-ID");
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ========================================================================
     6. KOMPONEN UI
     Semua teks dari pengguna dimasukkan lewat textContent atau escapeHTML().
     ======================================================================== */
  const ui = { highlightId: null };

  const icon = (name, cls = "") => `<svg class="icon ${cls}" aria-hidden="true"><use href="#${name}"></use></svg>`;

  function badgeHTML(status) {
    const s = STATUSES[status] || STATUSES.baru;
    return `<span class="badge badge--${s.id}">${icon(s.icon)}${s.label}</span>`;
  }

  function categoryChipHTML(categoryId) {
    const c = getCategory(categoryId);
    return `<span class="cat-chip">${icon(c.icon)}${escapeHTML(c.label)}</span>`;
  }

  function avatarHTML(user) {
    if (user && user.avatarUrl) {
      return `<img src="${escapeHTML(user.avatarUrl)}" alt="Foto profil ${escapeHTML(user.fullName)}" data-fallback="initials" data-initials="${escapeHTML(initials(user.fullName))}" />`;
    }
    return `<span aria-hidden="true">${escapeHTML(initials(user ? user.fullName : "?"))}</span>`;
  }

  function cloneTemplate(id) {
    return document.getElementById(id).content.cloneNode(true);
  }

  /** Kartu laporan untuk dashboard. */
  function renderReportCard(report) {
    const frag = cloneTemplate("tpl-report-card");
    const card = frag.querySelector(".report-card");
    const slot = (name) => card.querySelector(`[data-slot="${name}"]`);
    card.dataset.reportId = report.id;
    if (ui.highlightId === report.id) card.classList.add("is-new");
    const img = slot("img");
    img.src = report.photoUrl;
    img.alt = `Foto kerusakan: ${report.title}`;
    slot("badge").innerHTML = badgeHTML(report.status);
    slot("category").outerHTML = categoryChipHTML(report.category);
    slot("id").textContent = report.id;
    slot("title").textContent = report.title;
    slot("location").textContent = report.location;
    slot("location").title = report.location;
    const time = slot("date");
    time.dateTime = report.createdAt;
    time.textContent = formatDate(report.createdAt);
    slot("desc").textContent = report.description;
    slot("reporter").textContent = `Oleh ${report.reporterName}`;
    card.querySelector('[data-action="view-report"]').setAttribute("aria-label", `Lihat detail laporan: ${report.title}`);
    return frag;
  }

  function renderSkeletonCards(container, count = 6) {
    container.innerHTML = Array.from({ length: count })
      .map(
        () => `<div class="skeleton-card" aria-hidden="true">
          <div class="skeleton skeleton-card__media"></div>
          <div class="skeleton-card__body">
            <div class="skeleton skeleton-line skeleton-line--sm"></div>
            <div class="skeleton skeleton-line skeleton-line--lg"></div>
            <div class="skeleton skeleton-line"></div>
            <div class="skeleton skeleton-line skeleton-line--sm"></div>
          </div></div>`
      )
      .join("");
    container.setAttribute("aria-busy", "true");
  }

  function renderEmptyState({ iconName = "i-inbox", title, text, actionLabel, action, href }) {
    let actionHTML = "";
    if (actionLabel && href) actionHTML = `<a class="btn btn--primary btn--sm" href="${href}">${icon("i-plus")}${actionLabel}</a>`;
    else if (actionLabel) actionHTML = `<button class="btn btn--secondary btn--sm" type="button" data-action="${action}">${icon("i-refresh")}${actionLabel}</button>`;
    return `<div class="empty-state">
      <span class="empty-state__icon">${icon(iconName)}</span>
      <h3>${escapeHTML(title)}</h3>
      <p>${escapeHTML(text)}</p>
      ${actionHTML}
    </div>`;
  }

  /** Notifikasi singkat. type: success | error | info | warning */
  function showToast(message, type = "success", timeout = 4500) {
    const region = $("#toast-region");
    if (!region) return;
    const icons = { success: "i-check-circle", error: "i-alert", info: "i-info", warning: "i-alert-triangle" };
    const toast = document.createElement("div");
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `${icon(icons[type] || icons.info)}<p class="toast__msg"></p><button class="toast__close" type="button" aria-label="Tutup notifikasi">${icon("i-x")}</button>`;
    toast.querySelector(".toast__msg").textContent = message;
    const remove = () => {
      if (!toast.isConnected) return;
      toast.classList.add("is-leaving");
      setTimeout(() => toast.remove(), 260);
    };
    toast.querySelector(".toast__close").addEventListener("click", remove);
    region.appendChild(toast);
    while (region.children.length > 3) region.firstElementChild.remove();
    setTimeout(remove, timeout);
  }

  /** Status memuat pada tombol. */
  function setButtonLoading(btn, loading, loadingText = "Memproses…") {
    if (!btn) return;
    const label = btn.querySelector(".btn__label");
    if (loading) {
      if (label && !btn.dataset.label) btn.dataset.label = label.textContent;
      if (label) label.textContent = loadingText;
      btn.classList.add("is-loading");
      btn.disabled = true;
      btn.setAttribute("aria-busy", "true");
    } else {
      if (label && btn.dataset.label) label.textContent = btn.dataset.label;
      delete btn.dataset.label;
      btn.classList.remove("is-loading");
      btn.disabled = false;
      btn.removeAttribute("aria-busy");
    }
  }

  /* --- Validasi formulir (generik) --- */
  function getFieldValue(form, name) {
    const el = form.elements[name];
    if (!el) return "";
    if (el.type === "checkbox") return el.checked;
    return el.value || "";
  }

  function setFieldError(form, name, message) {
    const field = form.querySelector(`[data-field="${name}"]`);
    if (!field) return;
    const error = field.querySelector(".field__error");
    field.classList.toggle("field--invalid", Boolean(message));
    $$("input, textarea, select", field).forEach((control) => {
      if (message) control.setAttribute("aria-invalid", "true");
      else control.removeAttribute("aria-invalid");
    });
    if (!error) return;
    if (message) {
      error.innerHTML = `${icon("i-alert")}<span></span>`;
      error.querySelector("span").textContent = message;
      error.hidden = false;
    } else {
      error.hidden = true;
      error.textContent = "";
    }
  }

  function validateForm(form, rules) {
    const errors = [];
    Object.entries(rules).forEach(([name, rule]) => {
      const message = rule(getFieldValue(form, name), form);
      setFieldError(form, name, message);
      if (message) errors.push({ name, message });
    });
    return errors;
  }

  function clearFormErrors(form) {
    $$("[data-field]", form).forEach((f) => setFieldError(form, f.dataset.field, ""));
  }

  /** Validasi saat blur (jika terisi) dan perbarui pesan saat pengguna memperbaiki isian. */
  function attachLiveValidation(form, rules) {
    const isInvalid = (name) => form.querySelector(`[data-field="${name}"]`)?.classList.contains("field--invalid");
    const run = (name) => setFieldError(form, name, rules[name](getFieldValue(form, name), form));
    form.addEventListener("focusout", (e) => {
      const { name, type, value } = e.target;
      if (!rules[name] || type === "radio" || type === "checkbox" || type === "file") return;
      if (value || isInvalid(name)) run(name);
    });
    form.addEventListener("input", (e) => {
      const { name } = e.target;
      if (rules[name] && isInvalid(name)) run(name);
      // Konfirmasi kata sandi ikut divalidasi ulang ketika kata sandi berubah.
      if (name === "password" && rules.confirm && isInvalid("confirm")) run("confirm");
    });
    form.addEventListener("change", (e) => {
      const { name, type } = e.target;
      if (rules[name] && (type === "radio" || type === "checkbox")) run(name);
    });
  }

  function focusFirstError(form, errors) {
    if (!errors.length) return;
    const field = form.querySelector(`[data-field="${errors[0].name}"]`);
    const control = field && field.querySelector("input:not([type=hidden]), textarea, select");
    if (control) {
      control.focus({ preventScroll: true });
      field.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
    }
  }

  function showFormAlert(box, message, items = []) {
    if (!box) return;
    box.innerHTML = `${icon("i-alert")}<div><p></p>${items.length ? "<ul></ul>" : ""}</div>`;
    box.querySelector("p").textContent = message;
    const ul = box.querySelector("ul");
    items.forEach((text) => {
      const li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    });
    box.hidden = false;
  }
  const hideFormAlert = (box) => box && (box.hidden = true);

  function bindPasswordToggles(root) {
    $$('[data-action="toggle-password"]', root).forEach((btn) => {
      btn.addEventListener("click", () => {
        const input = btn.parentElement.querySelector("input");
        const show = input.type === "password";
        input.type = show ? "text" : "password";
        btn.setAttribute("aria-pressed", String(show));
        btn.setAttribute("aria-label", show ? "Sembunyikan kata sandi" : "Tampilkan kata sandi");
        btn.querySelector("use").setAttribute("href", show ? "#i-eye-off" : "#i-eye");
      });
    });
  }

  /* --- Filter toolbar (dipakai Dashboard & Status) --- */
  function populateCategorySelect(select, allLabel = "Semua kategori") {
    select.innerHTML = `<option value="">${allLabel}</option>` + CATEGORIES.map((c) => `<option value="${c.id}">${escapeHTML(c.label)}</option>`).join("");
  }
  function populateStatusSelect(select) {
    select.innerHTML = `<option value="">Semua status</option>` + STATUS_ORDER.map((s) => `<option value="${s}">${STATUSES[s].label}</option>`).join("");
  }

  /**
   * Menghubungkan input pencarian, select, dan tombol status ke objek `filters`.
   * Mengembalikan fungsi reset().
   */
  function bindFilters(root, filters, onChange) {
    const search = $('[data-filter="search"]', root);
    const clearBtn = $('[data-action="clear-search"]', root);
    const category = $('[data-filter="category"]', root);
    const statusSelect = $('[data-filter="status"]', root);

    const syncStatus = () => {
      $$("[data-status-filter]", root).forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.statusFilter === filters.status)));
      if (statusSelect) statusSelect.value = filters.status;
    };

    const onSearch = debounce(() => {
      filters.search = search.value.trim();
      onChange();
    }, 200);
    search.addEventListener("input", () => {
      clearBtn.hidden = !search.value;
      onSearch();
    });
    clearBtn.addEventListener("click", () => {
      search.value = "";
      clearBtn.hidden = true;
      filters.search = "";
      search.focus();
      onChange();
    });
    category?.addEventListener("change", () => {
      filters.category = category.value;
      onChange();
    });
    statusSelect?.addEventListener("change", () => {
      filters.status = statusSelect.value;
      syncStatus();
      onChange();
    });
    root.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-status-filter]");
      if (!btn) return;
      filters.status = btn.dataset.statusFilter;
      syncStatus();
      onChange();
    });

    return {
      sync: syncStatus,
      reset() {
        filters.search = filters.category = filters.status = "";
        search.value = "";
        clearBtn.hidden = true;
        if (category) category.value = "";
        syncStatus();
        onChange();
      },
    };
  }

  const hasActiveFilters = (f) => Boolean(f.search || f.category || f.status);

  /* --- Detail laporan (dialog) --- */
  let detailToken = 0;

  async function openReportDetail(id) {
    const dialog = $("#report-dialog");
    const body = $('[data-slot="report-dialog-body"]', dialog);
    const token = ++detailToken;
    body.innerHTML = `<div class="detail-empty" aria-busy="true"><h2 id="report-dialog-title" class="sr-only">Memuat detail laporan</h2><span class="spinner" aria-hidden="true"></span><p>Memuat detail laporan…</p></div>`;
    if (!dialog.open) dialog.showModal();
    try {
      const report = await getReportById(id);
      if (token !== detailToken) return;
      renderReportDetail(body, report);
    } catch (err) {
      if (token !== detailToken) return;
      body.innerHTML = `<div class="detail-empty">
        <span class="empty-state__icon">${icon("i-alert-triangle")}</span>
        <h2 id="report-dialog-title" class="dialog__title">Laporan tidak ditemukan</h2>
        <p class="dialog__sub">${escapeHTML(err.message)}</p>
        <button class="btn btn--secondary" type="button" data-action="close-dialog">Tutup</button></div>`;
    }
  }

  function timelineHTML(report) {
    const currentIdx = STATUS_ORDER.indexOf(report.status);
    return STATUS_ORDER.map((status, idx) => {
      const s = STATUSES[status];
      const done = idx <= currentIdx;
      const entry = [...report.history].reverse().find((h) => h.status === status);
      const detail =
        done && entry
          ? `<time datetime="${entry.date}">${formatDateTime(entry.date)}</time><p>${escapeHTML(entry.note)}</p>`
          : `<p>${idx === currentIdx + 1 ? "Tahap berikutnya" : "Menunggu"}</p>`;
      return `<li class="timeline__item ${done ? "is-done" : ""}" data-status="${status}">
        <span class="timeline__dot">${icon(done ? s.icon : "i-clock")}</span>
        <div class="timeline__content"><strong>${s.label}</strong>${detail}</div></li>`;
    }).join("");
  }

  function renderReportDetail(body, r) {
    const statusOptions = STATUS_ORDER.map((s) => `<option value="${s}" ${s === r.status ? "selected" : ""}>${STATUSES[s].label}</option>`).join("");
    body.innerHTML = `<article class="detail">
      <div class="detail__media">
        <img src="${escapeHTML(r.photoUrl)}" alt="Foto kerusakan: ${escapeHTML(r.title)}" data-fallback />
        <span class="detail__public">${icon("i-globe")}Foto dapat dilihat publik</span>
        <button class="icon-btn detail__close" type="button" data-action="close-dialog" aria-label="Tutup detail laporan">${icon("i-x")}</button>
      </div>
      <div class="detail__body">
        <div class="detail__top">${badgeHTML(r.status)}${categoryChipHTML(r.category)}<span class="detail__id">${escapeHTML(r.id)}</span></div>
        <h2 id="report-dialog-title" class="detail__title">${escapeHTML(r.title)}</h2>
        <ul class="detail__meta">
          <li class="detail__meta-item">${icon("i-pin")}<div><span class="detail__meta-label">Lokasi</span><span class="detail__meta-value">${escapeHTML(r.location)}</span>
            <button class="link-btn" type="button" data-action="copy-location">${icon("i-copy")}Salin alamat</button></div></li>
          <li class="detail__meta-item">${icon("i-calendar")}<div><span class="detail__meta-label">Tanggal Laporan</span><span class="detail__meta-value"><time datetime="${r.createdAt}">${formatDateTime(r.createdAt)}</time></span></div></li>
          <li class="detail__meta-item">${icon("i-refresh")}<div><span class="detail__meta-label">Pembaruan Terakhir</span><span class="detail__meta-value">${formatRelative(r.updatedAt)}</span></div></li>
          <li class="detail__meta-item">${icon("i-user")}<div><span class="detail__meta-label">Pelapor</span><span class="detail__meta-value">${escapeHTML(r.reporterName)}</span></div></li>
        </ul>
        <section><h3 class="detail__section-title">Deskripsi Kerusakan</h3><p class="detail__desc">${escapeHTML(r.description)}</p></section>
        <section><h3 class="detail__section-title">Riwayat Status</h3><ol class="timeline">${timelineHTML(r)}</ol></section>
        <section class="sim-panel" aria-labelledby="sim-title">
          <h3 id="sim-title" class="sim-panel__head">${icon("i-wrench")}Simulasi Petugas (Demo)</h3>
          <p class="sim-panel__note">Fitur ini hanya untuk demonstrasi. Pada sistem nyata, status diperbarui oleh petugas melalui panel admin.</p>
          <form class="sim-panel__form" data-slot="sim-form" novalidate>
            <div class="form-grid-2">
              <div class="field"><label class="field__label" for="sim-status">Ubah status</label>
                <div class="select-wrap"><select class="input select" id="sim-status" name="status">${statusOptions}</select>${icon("i-chevron-down", "select-wrap__icon")}</div></div>
              <div class="field"><label class="field__label" for="sim-note">Catatan <span class="field__optional">(opsional)</span></label>
                <input class="input" id="sim-note" name="note" type="text" maxlength="160" placeholder="Contoh: Tim lapangan dijadwalkan besok" /></div>
            </div>
            <div><button class="btn btn--primary btn--sm" type="submit">${icon("i-refresh")}<span class="btn__label">Perbarui Status</span></button></div>
          </form>
        </section>
      </div></article>`;

    $('[data-action="copy-location"]', body).addEventListener("click", () => copyText(r.location, "Alamat berhasil disalin."));

    const form = $('[data-slot="sim-form"]', body);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const status = form.elements.status.value;
      if (status === r.status) {
        showToast("Status yang dipilih sama dengan status saat ini.", "info");
        return;
      }
      const btn = form.querySelector('[type="submit"]');
      setButtonLoading(btn, true, "Menyimpan…");
      try {
        const updated = await updateReportStatus(r.id, status, form.elements.note.value);
        showToast(`Status laporan diperbarui menjadi "${STATUSES[status].label}".`, "success");
        renderReportDetail(body, updated);
        $("#sim-status", body)?.focus();
        // Perbarui tampilan di belakang dialog (statistik & daftar).
        router.controller?.refresh?.();
      } catch (err) {
        showToast(err.message, "error");
        setButtonLoading(btn, false);
      }
    });
  }

  async function copyText(text, successMsg) {
    try {
      await navigator.clipboard.writeText(text);
      showToast(successMsg, "success");
    } catch (_) {
      showToast("Gagal menyalin. Silakan salin secara manual.", "error");
    }
  }

  /* --- Dialog konfirmasi --- */
  function confirmDialog() {
    const dialog = $("#confirm-dialog");
    return new Promise((resolve) => {
      dialog.returnValue = "";
      dialog.addEventListener("close", () => resolve(dialog.returnValue === "confirm"), { once: true });
      dialog.showModal();
    });
  }

  /* ========================================================================
     7. KONTROLER HALAMAN
     Setiap fungsi init menerima elemen kontainer dan boleh mengembalikan
     { refresh() } untuk memuat ulang data tanpa merender ulang halaman.
     ======================================================================== */

  /* ---- Landing ---- */
  function initLanding(root) {
    $('[data-slot="year"]', root).textContent = new Date().getFullYear();

    // Statistik publik dihitung dari dataset laporan yang sama.
    const statsSection = $("#statistik", root);
    let statsLoaded = null;
    const startStats = () => {
      if (statsLoaded) return;
      statsLoaded = getDashboardStats().then((stats) => {
        $$("[data-stat]", root).forEach((el) => animateCount(el, stats[el.dataset.stat]));
      });
    };
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          startStats();
          io.disconnect();
        }
      });
      io.observe(statsSection);
    } else startStats();

    // Kartu contoh laporan pada hero
    getReports({ status: "proses" }).then((reports) => {
      const r = reports[0];
      const card = $('[data-slot="hero-card"]', root);
      if (!r || !card) return;
      card.innerHTML = `<img class="hero-card__img" src="${escapeHTML(r.photoUrl)}" alt="Foto kerusakan: ${escapeHTML(r.title)}" data-fallback />
        <div class="hero-card__body">
          <p class="hero-card__label">Laporan terkini</p>
          <h2 class="hero-card__title">${escapeHTML(r.title)}</h2>
          <div class="hero-card__meta"><span>${icon("i-pin")}${escapeHTML(shortLocation(r.location))}</span>${badgeHTML(r.status)}</div>
        </div>`;
    });
  }

  /* ---- Masuk ---- */
  function initLogin(root) {
    const form = $("#login-form", root);
    const alertBox = $('[data-slot="form-alert"]', root);
    const submit = form.querySelector('[type="submit"]');
    bindPasswordToggles(root);

    const rules = {
      email: (v) => (!v.trim() ? "Email wajib diisi." : !EMAIL_RE.test(v.trim()) ? "Format email tidak valid, contoh: nama@email.com." : ""),
      password: (v) => (!v ? "Kata sandi wajib diisi." : v.length < 6 ? "Kata sandi minimal 6 karakter." : ""),
    };
    attachLiveValidation(form, rules);

    $('[data-action="fill-demo"]', root).addEventListener("click", () => {
      form.elements.email.value = "warga@laporfasilitas.id";
      form.elements.password.value = "demo123";
      clearFormErrors(form);
      hideFormAlert(alertBox);
      submit.focus();
    });
    $('[data-action="forgot"]', root).addEventListener("click", () =>
      showToast("Pemulihan kata sandi akan tersedia setelah sistem terhubung ke server.", "info")
    );

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideFormAlert(alertBox);
      const errors = validateForm(form, rules);
      if (errors.length) return focusFirstError(form, errors);
      setButtonLoading(submit, true, "Memproses…");
      try {
        const { user } = await loginUser({ email: form.elements.email.value, password: form.elements.password.value });
        showToast(`Selamat datang kembali, ${firstName(user.fullName)}!`, "success");
        const target = router.redirectAfterLogin || "#/dashboard";
        router.redirectAfterLogin = null;
        location.hash = target;
      } catch (err) {
        setButtonLoading(submit, false);
        showFormAlert(alertBox, err.message);
        if (err.fields) Object.entries(err.fields).forEach(([k, m]) => setFieldError(form, k, m));
        form.elements.password.focus();
      }
    });
  }

  /* ---- Daftar ---- */
  function passwordStrength(pw) {
    if (!pw) return 0;
    let level = 0;
    if (pw.length >= 8) level++;
    if (/[a-zA-Z]/.test(pw) && /\d/.test(pw)) level++;
    if (pw.length >= 12 || /[^a-zA-Z0-9]/.test(pw)) level++;
    return Math.max(1, level);
  }

  function initRegister(root) {
    const form = $("#register-form", root);
    const alertBox = $('[data-slot="form-alert"]', root);
    const submit = form.querySelector('[type="submit"]');
    const meter = $(".strength", root);
    const meterText = $('[data-slot="strength-text"]', root);
    bindPasswordToggles(root);

    const rules = {
      fullName: (v) => (!v.trim() ? "Nama lengkap wajib diisi." : v.trim().length < 3 ? "Nama minimal 3 karakter." : ""),
      email: (v) => (!v.trim() ? "Email wajib diisi." : !EMAIL_RE.test(v.trim()) ? "Format email tidak valid, contoh: nama@email.com." : ""),
      phone: (v) => (v.trim() && !PHONE_RE.test(normalizePhone(v)) ? "Nomor HP tidak valid. Contoh: 081234567890." : ""),
      password: (v) => (!v ? "Kata sandi wajib diisi." : v.length < 8 ? "Kata sandi minimal 8 karakter." : ""),
      confirm: (v, f) => (!v ? "Konfirmasi kata sandi wajib diisi." : v !== f.elements.password.value ? "Konfirmasi kata sandi tidak sama." : ""),
      agree: (v) => (v ? "" : "Anda perlu menyetujui ketentuan untuk melanjutkan."),
    };
    attachLiveValidation(form, rules);

    form.elements.password.addEventListener("input", (e) => {
      const level = passwordStrength(e.target.value);
      meter.dataset.level = String(level);
      meterText.textContent = ["Gunakan kombinasi huruf dan angka.", "Kekuatan: lemah", "Kekuatan: sedang", "Kekuatan: kuat"][level];
    });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      hideFormAlert(alertBox);
      const errors = validateForm(form, rules);
      if (errors.length) return focusFirstError(form, errors);
      setButtonLoading(submit, true, "Membuat akun…");
      try {
        const { user } = await registerUser({
          fullName: form.elements.fullName.value,
          email: form.elements.email.value,
          phone: form.elements.phone.value,
          password: form.elements.password.value,
        });
        showToast(`Akun berhasil dibuat. Selamat datang, ${firstName(user.fullName)}!`, "success");
        location.hash = "#/dashboard";
      } catch (err) {
        setButtonLoading(submit, false);
        showFormAlert(alertBox, err.message);
        if (err.fields) {
          Object.entries(err.fields).forEach(([k, m]) => setFieldError(form, k, m));
          focusFirstError(form, Object.keys(err.fields).map((name) => ({ name })));
        }
      }
    });
  }

  /* ---- Dashboard ---- */
  function renderStatCards(container, stats) {
    const pct = (n) => (stats.total ? Math.round((n / stats.total) * 100) : 0);
    const cards = [
      {
        cls: "pending",
        label: "Laporan Belum Selesai",
        value: stats.belumSelesai,
        iconName: "i-clock",
        bar: pct(stats.belumSelesai),
        note: `Baru: <b>${stats.baru}</b> · Dalam Proses: <b>${stats.proses}</b>`,
      },
      {
        cls: "done",
        label: "Laporan Selesai",
        value: stats.selesai,
        iconName: "i-check-circle",
        bar: pct(stats.selesai),
        note: `<b>${pct(stats.selesai)}%</b> dari seluruh laporan telah ditangani`,
      },
      { cls: "total", label: "Total Seluruh Laporan", value: stats.total, iconName: "i-clipboard", bar: 100, note: "Seluruh laporan publik yang tercatat" },
    ];
    container.innerHTML = cards
      .map(
        (c) => `<article class="stat-card stat-card--${c.cls}">
        <div class="stat-card__top"><h2 class="stat-card__label">${c.label}</h2><span class="stat-card__icon">${icon(c.iconName)}</span></div>
        <p class="stat-card__value"><span data-count="${c.value}">${c.value}</span><small>laporan</small></p>
        <div class="stat-card__bar" aria-hidden="true"><span style="width:0" data-width="${c.bar}%"></span></div>
        <p class="stat-card__note">${c.note}</p></article>`
      )
      .join("");
    requestAnimationFrame(() => $$("[data-width]", container).forEach((el) => (el.style.width = el.dataset.width)));
  }

  function renderStatusChips(container, stats) {
    const chips = [{ id: "", label: "Semua", count: stats ? stats.total : "" }].concat(
      STATUS_ORDER.map((s) => ({ id: s, label: STATUSES[s].label, iconName: STATUSES[s].icon, count: stats ? stats[s] : "" }))
    );
    container.innerHTML = chips
      .map(
        (c) => `<button class="chip" type="button" data-status-filter="${c.id}" ${c.id ? `data-status="${c.id}"` : ""} aria-pressed="false">
        ${c.iconName ? icon(c.iconName) : icon("i-layers")}${c.label}<span class="chip__count">${c.count}</span></button>`
      )
      .join("");
  }

  function initDashboard(root) {
    const user = getSessionUser();
    $('[data-slot="today"]', root).textContent = formatDateLong(new Date().toISOString());
    $('[data-slot="first-name"]', root).textContent = firstName(user.fullName);

    const statsEl = $('[data-slot="stats"]', root);
    const listEl = $('[data-slot="list"]', root);
    const countEl = $('[data-slot="result-count"]', root);
    const chipsEl = $('[data-slot="status-chips"]', root);
    populateCategorySelect($('[data-filter="category"]', root));

    const filters = { search: "", category: "", status: "" };
    let all = [];

    statsEl.innerHTML = '<div class="skeleton skeleton-stat"></div>'.repeat(3);
    renderStatusChips(chipsEl, null);
    renderSkeletonCards(listEl, 6);
    countEl.textContent = "Memuat laporan…";

    const apply = () => {
      const list = filterReports(all, filters);
      listEl.removeAttribute("aria-busy");
      if (!list.length) {
        listEl.innerHTML = hasActiveFilters(filters)
          ? renderEmptyState({ iconName: "i-search", title: "Laporan tidak ditemukan", text: "Coba ubah kata kunci pencarian atau atur ulang filter kategori dan status.", actionLabel: "Atur ulang filter", action: "reset-filters" })
          : renderEmptyState({ title: "Belum ada laporan", text: "Jadilah warga pertama yang melaporkan kerusakan fasilitas publik.", actionLabel: "Buat Laporan", href: "#/buat-laporan" });
      } else {
        const frag = document.createDocumentFragment();
        list.forEach((r) => frag.appendChild(renderReportCard(r)));
        listEl.replaceChildren(frag);
      }
      countEl.innerHTML = `Menampilkan <strong>${list.length}</strong> dari ${all.length} laporan`;
    };

    const filterCtl = bindFilters(root, filters, apply);

    async function load() {
      try {
        const [stats, reports] = await Promise.all([getDashboardStats(), getReports()]);
        all = reports;
        renderStatCards(statsEl, stats);
        renderStatusChips(chipsEl, stats);
        filterCtl.sync();
        apply();
        // Sorotan laporan baru hanya tampil sekali.
        if (ui.highlightId) setTimeout(() => (ui.highlightId = null), 100);
      } catch (err) {
        statsEl.innerHTML = "";
        listEl.innerHTML = renderEmptyState({ iconName: "i-alert-triangle", title: "Gagal memuat laporan", text: err.message, actionLabel: "Coba lagi", action: "retry" });
        countEl.textContent = "";
      }
    }

    listEl.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="reset-filters"]')) filterCtl.reset();
      if (e.target.closest('[data-action="retry"]')) {
        renderSkeletonCards(listEl, 6);
        load();
      }
    });

    load();
    return { refresh: load };
  }

  /* ---- Buat Laporan ---- */
  function initCreateReport(root) {
    const form = $("#report-form", root);
    const alertBox = $('[data-slot="form-alert"]', root);
    const submit = form.querySelector('[type="submit"]');
    const success = $('[data-slot="success"]', root);
    const fileInput = $("#rf-photo", root);
    const dropzone = $('[data-slot="dropzone"]', root);
    const preview = $('[data-slot="preview"]', root);
    const previewImg = $('[data-slot="preview-img"]', root);
    let selectedFile = null;
    let previewUrl = null;
    let createdId = null;

    // Opsi kategori dibuat dari data CATEGORIES.
    $('[data-slot="category-options"]', root).innerHTML = CATEGORIES.map(
      (c) => `<label class="cat-option"><input type="radio" name="category" value="${c.id}" aria-describedby="rf-category-error" />
        <span class="cat-option__box"><span class="cat-option__icon">${icon(c.icon)}</span>${escapeHTML(c.label)}</span></label>`
    ).join("");

    const rules = {
      title: (v) => {
        const len = v.trim().length;
        return !len ? "Judul laporan wajib diisi." : len < 10 ? `Judul minimal 10 karakter (saat ini ${len}).` : "";
      },
      category: (v) => (v ? "" : "Pilih salah satu kategori fasilitas."),
      description: (v) => {
        const len = v.trim().length;
        return !len ? "Deskripsi kerusakan wajib diisi." : len < 30 ? `Deskripsi minimal 30 karakter (saat ini ${len}).` : "";
      },
      location: (v) => (!v.trim() ? "Lokasi atau alamat wajib diisi." : v.trim().length < 10 ? "Alamat terlalu singkat. Sertakan nama jalan dan kota." : ""),
      photo: () => (selectedFile ? "" : "Unggah foto kerusakan sebagai bukti laporan."),
      consent: (v) => (v ? "" : "Centang pernyataan ini untuk melanjutkan."),
    };
    attachLiveValidation(form, rules);

    // Penghitung karakter
    const updateCounters = () =>
      $$("[data-counter]", root).forEach((el) => {
        const input = document.getElementById(el.dataset.counter);
        el.textContent = `${input.value.length}/${input.maxLength}`;
      });
    form.addEventListener("input", updateCounters);

    // Foto: pilih, seret & lepas, pratinjau
    function clearPhoto() {
      selectedFile = null;
      fileInput.value = "";
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      previewImg.removeAttribute("src");
      preview.hidden = true;
      dropzone.hidden = false;
    }
    function handleFile(file) {
      if (!file) return;
      if (!PHOTO_TYPES.includes(file.type)) {
        clearPhoto();
        setFieldError(form, "photo", "Format file tidak didukung. Gunakan foto JPG, PNG, atau WEBP.");
        return;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        clearPhoto();
        setFieldError(form, "photo", `Ukuran foto terlalu besar (${formatBytes(file.size)}). Maksimal 5 MB.`);
        return;
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      selectedFile = file;
      previewUrl = URL.createObjectURL(file);
      previewImg.onerror = () => {
        clearPhoto();
        setFieldError(form, "photo", "File gambar rusak atau tidak dapat dibaca. Pilih foto lain.");
      };
      previewImg.src = previewUrl;
      previewImg.alt = `Pratinjau foto: ${file.name}`;
      $('[data-slot="preview-name"]', root).textContent = file.name;
      $('[data-slot="preview-size"]', root).textContent = `${formatBytes(file.size)} · siap diunggah`;
      preview.hidden = false;
      dropzone.hidden = true;
      setFieldError(form, "photo", "");
    }
    fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));
    ["dragenter", "dragover"].forEach((type) =>
      dropzone.addEventListener(type, (e) => {
        e.preventDefault();
        dropzone.classList.add("is-dragover");
      })
    );
    ["dragleave", "dragend", "drop"].forEach((type) => dropzone.addEventListener(type, () => dropzone.classList.remove("is-dragover")));
    dropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      const file = e.dataTransfer && e.dataTransfer.files[0];
      handleFile(file);
    });
    $('[data-action="replace-photo"]', root).addEventListener("click", () => fileInput.click());
    $('[data-action="remove-photo"]', root).addEventListener("click", () => {
      clearPhoto();
      fileInput.focus();
      showToast("Foto dihapus dari formulir.", "info", 2500);
    });

    // Lokasi saat ini (opsional)
    const geoBtn = $('[data-action="use-geolocation"]', root);
    geoBtn.addEventListener("click", () => {
      if (!("geolocation" in navigator)) {
        showToast("Browser Anda tidak mendukung deteksi lokasi. Silakan isi alamat secara manual.", "error");
        return;
      }
      geoBtn.disabled = true;
      const original = geoBtn.innerHTML;
      geoBtn.innerHTML = `${icon("i-crosshair")}Mendeteksi lokasi…`;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // TODO(API): ubah koordinat menjadi alamat (reverse geocoding) melalui backend.
          const coord = `Koordinat: ${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`;
          const loc = form.elements.location;
          loc.value = loc.value.trim() ? `${loc.value.trim()} (${coord})` : coord;
          loc.dispatchEvent(new Event("input", { bubbles: true }));
          geoBtn.disabled = false;
          geoBtn.innerHTML = original;
          showToast("Koordinat ditambahkan. Lengkapi dengan nama jalan agar mudah ditemukan petugas.", "info");
        },
        (err) => {
          geoBtn.disabled = false;
          geoBtn.innerHTML = original;
          showToast(err.code === 1 ? "Izin lokasi ditolak. Silakan isi alamat secara manual." : "Lokasi tidak dapat dideteksi. Silakan isi alamat secara manual.", "error");
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    });

    // Kosongkan formulir
    form.addEventListener("reset", () => {
      setTimeout(() => {
        clearFormErrors(form);
        hideFormAlert(alertBox);
        clearPhoto();
        updateCounters();
      });
    });

    // Kirim laporan
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errors = validateForm(form, rules);
      if (errors.length) {
        showFormAlert(
          alertBox,
          `Laporan belum dapat dikirim. Periksa ${errors.length} isian berikut:`,
          errors.map((er) => er.message)
        );
        focusFirstError(form, errors);
        return;
      }
      hideFormAlert(alertBox);
      setButtonLoading(submit, true, "Mengirim laporan…");
      form.setAttribute("aria-busy", "true");
      try {
        const loc = form.elements.location.value.trim();
        const landmark = form.elements.landmark.value.trim();
        const report = await createReport({
          title: form.elements.title.value,
          category: form.elements.category.value,
          description: form.elements.description.value,
          location: landmark ? `${loc} (Patokan: ${landmark})` : loc,
          photo: selectedFile,
        });
        createdId = report.id;
        ui.highlightId = report.id;
        $('[data-slot="success-id"]', root).textContent = report.id;
        form.hidden = true;
        success.hidden = false;
        success.focus();
        success.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });
        showToast("Laporan berhasil dikirim dan kini tampil di dashboard.", "success");
      } catch (err) {
        if (err.fields) Object.entries(err.fields).forEach(([k, m]) => setFieldError(form, k, m));
        showFormAlert(alertBox, err.message || "Laporan gagal dikirim. Silakan coba lagi.");
        showToast(err.message || "Laporan gagal dikirim. Silakan coba lagi.", "error");
      } finally {
        setButtonLoading(submit, false);
        form.removeAttribute("aria-busy");
      }
    });

    $('[data-action="view-new-report"]', root).addEventListener("click", () => createdId && openReportFromUI(createdId));
    $('[data-action="new-report"]', root).addEventListener("click", () => {
      form.reset();
      form.hidden = false;
      success.hidden = true;
      window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
      form.elements.title.focus({ preventScroll: true });
    });

    updateCounters();
    return {
      destroy() {
        if (previewUrl) URL.revokeObjectURL(previewUrl);
      },
    };
  }

  /* ---- Status Laporan ---- */
  function statusRowHTML(r) {
    return `<tr data-status="${r.status}" data-report-id="${escapeHTML(r.id)}" class="${ui.highlightId === r.id ? "is-new" : ""}">
      <td data-label="Judul"><div class="row-title"><img src="${escapeHTML(r.photoUrl)}" alt="" loading="lazy" data-fallback /><div><strong>${escapeHTML(r.title)}</strong><small>${escapeHTML(r.id)}</small></div></div></td>
      <td data-label="Tanggal" class="nowrap"><time datetime="${r.createdAt}">${formatDate(r.createdAt)}</time></td>
      <td data-label="Kategori">${categoryChipHTML(r.category)}</td>
      <td data-label="Lokasi"><span class="row-location" title="${escapeHTML(r.location)}">${escapeHTML(r.location)}</span></td>
      <td data-label="Status">${badgeHTML(r.status)}</td>
      <td data-label="Aksi"><button class="btn btn--secondary btn--sm" type="button" data-action="view-report" aria-label="Lihat detail laporan: ${escapeHTML(r.title)}">${icon("i-eye")}Detail</button></td>
    </tr>`;
  }

  function renderStatusSummary(container, stats) {
    const items = [{ id: "", label: "Semua Laporan", value: stats.total, iconName: "i-layers" }].concat(
      STATUS_ORDER.map((s) => ({ id: s, label: STATUSES[s].label, value: stats[s], iconName: STATUSES[s].icon }))
    );
    container.innerHTML = items
      .map(
        (i) => `<button class="summary-card ${i.id ? `summary-card--${i.id}` : ""}" type="button" data-status-filter="${i.id}" aria-pressed="false">
        <span class="summary-card__icon">${icon(i.iconName)}</span>
        <span><span class="summary-card__value">${i.value}</span><span class="summary-card__label">${i.label}</span></span></button>`
      )
      .join("");
  }

  function initStatus(root) {
    root.querySelector(".page").classList.add("status-page");
    const summaryEl = $('[data-slot="summary"]', root);
    const listEl = $('[data-slot="list"]', root);
    const countEl = $('[data-slot="result-count"]', root);
    populateStatusSelect($('[data-filter="status"]', root));
    populateCategorySelect($('[data-filter="category"]', root));

    const filters = { search: "", category: "", status: "" };
    let all = [];

    summaryEl.innerHTML = '<div class="skeleton skeleton-stat" style="height:72px"></div>'.repeat(4);
    listEl.innerHTML = `<div class="table-skeleton" aria-busy="true">${'<div class="skeleton" style="height:64px;margin-bottom:10px"></div>'.repeat(4)}</div>`;
    countEl.textContent = "Memuat laporan…";

    const apply = () => {
      const list = filterReports(all, filters);
      if (!all.length) {
        listEl.innerHTML = renderEmptyState({
          iconName: "i-file-plus",
          title: "Anda belum membuat laporan",
          text: "Laporkan kerusakan fasilitas publik di sekitar Anda dan pantau perkembangannya di sini.",
          actionLabel: "Buat Laporan",
          href: "#/buat-laporan",
        });
      } else if (!list.length) {
        listEl.innerHTML = renderEmptyState({ iconName: "i-search", title: "Tidak ada laporan yang cocok", text: "Coba ubah kata kunci atau filter yang digunakan.", actionLabel: "Atur ulang filter", action: "reset-filters" });
      } else {
        listEl.innerHTML = `<div class="table-wrap"><table class="status-table">
          <caption class="sr-only">Daftar laporan saya beserta statusnya</caption>
          <thead><tr><th scope="col">Judul Laporan</th><th scope="col">Tanggal</th><th scope="col">Kategori</th><th scope="col">Lokasi</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead>
          <tbody>${list.map(statusRowHTML).join("")}</tbody></table></div>`;
      }
      countEl.innerHTML = all.length ? `Menampilkan <strong>${list.length}</strong> dari ${all.length} laporan Anda` : "Belum ada laporan";
    };

    const filterCtl = bindFilters(root, filters, apply);

    async function load() {
      try {
        all = await getMyReports();
        renderStatusSummary(summaryEl, calculateStats(all));
        filterCtl.sync();
        apply();
        if (ui.highlightId) setTimeout(() => (ui.highlightId = null), 100);
      } catch (err) {
        listEl.innerHTML = renderEmptyState({ iconName: "i-alert-triangle", title: "Gagal memuat laporan", text: err.message, actionLabel: "Coba lagi", action: "retry" });
      }
    }

    listEl.addEventListener("click", (e) => {
      if (e.target.closest('[data-action="reset-filters"]')) filterCtl.reset();
      if (e.target.closest('[data-action="retry"]')) load();
    });

    load();
    return { refresh: load };
  }

  /* ---- Panduan ---- */
  function initGuide(root) {
    $('[data-slot="status-explain"]', root).innerHTML = STATUS_ORDER.map((s) => {
      const st = STATUSES[s];
      return `<div class="status-explain__item" style="--tone:${st.tone}">${badgeHTML(s)}<p>${escapeHTML(st.description)}</p></div>`;
    }).join("");
  }

  /* ---- Profil ---- */
  function initProfile(root) {
    function render(user, stats) {
      $('[data-slot="avatar"]', root).innerHTML = avatarHTML(user);
      $('[data-slot="name"]', root).textContent = user.fullName;
      $('[data-slot="email"]', root).textContent = user.email;
      const s = stats || { total: "–", belumSelesai: "–", selesai: "–", baru: 0, proses: 0 };
      $('[data-slot="mini-stats"]', root).innerHTML = `
        <div><strong>${s.total}</strong><span>Laporan</span></div>
        <div><strong>${s.belumSelesai}</strong><span>Berjalan</span></div>
        <div><strong>${s.selesai}</strong><span>Selesai</span></div>`;
      const rows = [
        ["i-user", "Nama Lengkap", escapeHTML(user.fullName)],
        ["i-mail", "Email", escapeHTML(user.email)],
        ["i-phone", "No. HP", escapeHTML(user.phone || "Belum diisi")],
        ["i-pin", "Kota / Kabupaten", escapeHTML(user.city || "Belum diisi")],
        ["i-shield", "ID Pengguna & Peran", `${escapeHTML(user.id)} · Warga`],
        ["i-calendar", "Bergabung Sejak", formatDate(user.joinedAt)],
        [
          "i-clipboard",
          "Ringkasan Laporan",
          stats
            ? `<span class="info-list__badges">${STATUS_ORDER.map((st) => badgeHTML(st).replace("</span>", ` · ${stats[st]}</span>`)).join("")}</span>`
            : "Memuat…",
        ],
      ];
      $('[data-slot="info"]', root).innerHTML = rows.map(([ic, label, value]) => `<div><dt>${icon(ic)}${label}</dt><dd>${value}</dd></div>`).join("");
    }

    async function load() {
      try {
        const [user, mine] = await Promise.all([getCurrentUser(), getMyReports()]);
        render(user, calculateStats(mine));
      } catch (err) {
        showToast(err.message, "error");
      }
    }

    render(getSessionUser(), null);
    $('[data-action="edit-profile"]', root).addEventListener("click", () => openProfileDialog());
    load();
    return { refresh: load };
  }

  /* --- Dialog edit profil (elemen global) --- */
  function openProfileDialog() {
    const dialog = $("#profile-dialog");
    const form = $("#profile-form");
    const user = getSessionUser();
    form.elements.fullName.value = user.fullName;
    form.elements.email.value = user.email;
    form.elements.phone.value = user.phone || "";
    form.elements.city.value = user.city || "";
    clearFormErrors(form);
    dialog.showModal();
    form.elements.fullName.focus();
  }

  function setupProfileDialog() {
    const dialog = $("#profile-dialog");
    const form = $("#profile-form");
    const rules = {
      fullName: (v) => (!v.trim() ? "Nama lengkap wajib diisi." : v.trim().length < 3 ? "Nama minimal 3 karakter." : ""),
      phone: (v) => (v.trim() && !PHONE_RE.test(normalizePhone(v)) ? "Nomor HP tidak valid. Contoh: 081234567890." : ""),
    };
    attachLiveValidation(form, rules);
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const errors = validateForm(form, rules);
      if (errors.length) return focusFirstError(form, errors);
      const btn = form.querySelector('[type="submit"]');
      setButtonLoading(btn, true, "Menyimpan…");
      try {
        const user = await updateUserProfile({ fullName: form.elements.fullName.value, phone: form.elements.phone.value, city: form.elements.city.value });
        dialog.close();
        updateHeaderUser(user);
        showToast("Profil berhasil diperbarui.", "success");
        router.controller?.refresh?.();
      } catch (err) {
        showToast(err.message, "error");
      } finally {
        setButtonLoading(btn, false);
      }
    });
  }

  /* ========================================================================
     8. ROUTER & SHELL APLIKASI (hash router: #/dashboard, #/laporan/LF-00101, …)
     ======================================================================== */
  const ROUTES = {
    "": { layout: "public", template: "tpl-landing", title: "Beranda", init: initLanding },
    masuk: { layout: "auth", template: "tpl-login", title: "Masuk", init: initLogin, guestOnly: true },
    daftar: { layout: "auth", template: "tpl-register", title: "Daftar", init: initRegister, guestOnly: true },
    dashboard: { layout: "app", template: "tpl-dashboard", title: "Dashboard", init: initDashboard, auth: true },
    "buat-laporan": { layout: "app", template: "tpl-create", title: "Buat Pelaporan", init: initCreateReport, auth: true },
    status: { layout: "app", template: "tpl-status", title: "Status Laporan", init: initStatus, auth: true },
    panduan: { layout: "app", template: "tpl-guide", title: "Panduan & Tentang", init: initGuide, auth: true },
    profil: { layout: "app", template: "tpl-profile", title: "Profil Akun", init: initProfile, auth: true },
  };
  const NOT_FOUND = { layout: "public", template: "tpl-404", title: "Halaman Tidak Ditemukan", init: null };

  const router = {
    current: null, // kunci rute yang sedang dirender
    controller: null,
    redirectAfterLogin: null,
    returnHash: "#/dashboard",
    detailPushed: false, // true jika detail dibuka dari klik (bisa history.back())
    closingByRoute: false,
    firstRender: true,
  };

  const LAYOUTS = {
    public: { shell: "#public-shell", view: "#public-view" },
    auth: { shell: "#auth-shell", view: "#auth-view" },
    app: { shell: "#app-shell", view: "#app-view" },
  };

  function parseHash() {
    const raw = location.hash || "";
    if (raw && !raw.startsWith("#/")) return { anchor: decodeURIComponent(raw.slice(1)) };
    const parts = raw.replace(/^#\/?/, "").replace(/\/+$/, "").split("/");
    if (parts[0] === "laporan" && parts[1]) return { path: "laporan", id: decodeURIComponent(parts[1]) };
    return { path: parts[0] || "" };
  }

  function navigate(hash, { replace = false } = {}) {
    if (replace) {
      history.replaceState(null, "", hash);
      handleRoute();
    } else if (location.hash === hash) {
      handleRoute();
    } else {
      location.hash = hash;
    }
  }

  function openReportFromUI(id) {
    router.detailPushed = true;
    location.hash = `#/laporan/${encodeURIComponent(id)}`;
  }

  function handleRoute() {
    const r = parseHash();

    // Tautan jangkar pada landing page (#tentang, #cara-kerja, …)
    if (r.anchor !== undefined) {
      if (router.current !== "") renderView("", ROUTES[""]);
      requestAnimationFrame(() => scrollToSection(r.anchor));
      return;
    }

    const user = getSessionUser();
    const dialog = $("#report-dialog");

    // Detail laporan dibuka di atas halaman aplikasi
    if (r.path === "laporan") {
      if (!user) return redirectToLogin();
      if (!router.current || ROUTES[router.current]?.layout !== "app") {
        renderView("dashboard", ROUTES.dashboard);
        router.detailPushed = false;
      }
      router.returnHash = `#/${router.current}`;
      openReportDetail(r.id);
      return;
    }

    if (dialog.open) {
      router.closingByRoute = true;
      dialog.close();
    }
    router.detailPushed = false;

    const route = ROUTES[r.path];
    if (!route) return renderView("__404", NOT_FOUND);
    if (route.auth && !user) return redirectToLogin();
    if (route.guestOnly && user) return navigate("#/dashboard", { replace: true });

    if (router.current === r.path && router.controller) {
      router.controller.refresh?.();
      return;
    }
    renderView(r.path, route);
  }

  function redirectToLogin() {
    router.redirectAfterLogin = location.hash;
    showToast("Silakan masuk terlebih dahulu untuk mengakses halaman ini.", "info");
    navigate("#/masuk", { replace: true });
  }

  function renderView(key, route) {
    router.controller?.destroy?.();
    Object.entries(LAYOUTS).forEach(([name, l]) => ($(l.shell).hidden = name !== route.layout));
    const view = $(LAYOUTS[route.layout].view);
    view.replaceChildren(cloneTemplate(route.template));
    router.current = key;
    document.title = `${route.title} · LaporFasilitas`;

    if (route.layout === "app") updateAppChrome(key, route.title);
    if (route.layout === "public") updatePublicChrome();
    closeDrawer(false);
    closeSiteNav();

    window.scrollTo(0, 0);
    router.controller = route.init ? route.init(view) || null : null;

    if (!router.firstRender) {
      const heading = view.querySelector("h1");
      heading?.focus({ preventScroll: true });
    }
    router.firstRender = false;
  }

  function updateAppChrome(key, title) {
    $$("[data-nav]").forEach((a) => {
      if (a.dataset.nav === key) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    $('[data-slot="header-title"]').textContent = title;
    updateHeaderUser(getSessionUser());
  }

  function updateHeaderUser(user) {
    if (!user) return;
    $('[data-slot="header-avatar"]').innerHTML = avatarHTML(user);
    $('[data-slot="header-name"]').textContent = firstName(user.fullName);
  }

  function updatePublicChrome() {
    const loggedIn = Boolean(getSessionUser());
    $('[data-slot="guest-actions"]').hidden = loggedIn;
    $('[data-slot="member-actions"]').hidden = !loggedIn;
    updateHeaderScroll();
  }

  function updateHeaderScroll() {
    const header = $("[data-site-header]");
    // Header transparan hanya di atas hero landing page.
    header.classList.toggle("is-scrolled", window.scrollY > 12 || router.current !== "");
  }

  function scrollToSection(id) {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
    closeSiteNav();
  }

  /* --- Navigasi landing (mobile) --- */
  function closeSiteNav() {
    const nav = $("#site-nav");
    const btn = $('[data-action="toggle-site-nav"]');
    if (!nav.classList.contains("is-open")) return;
    nav.classList.remove("is-open");
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", "Buka menu navigasi");
    btn.querySelector("use").setAttribute("href", "#i-menu");
  }
  function toggleSiteNav() {
    const nav = $("#site-nav");
    const btn = $('[data-action="toggle-site-nav"]');
    const open = !nav.classList.contains("is-open");
    if (!open) return closeSiteNav();
    nav.classList.add("is-open");
    btn.setAttribute("aria-expanded", "true");
    btn.setAttribute("aria-label", "Tutup menu navigasi");
    btn.querySelector("use").setAttribute("href", "#i-x");
    $("header.site-header").classList.add("is-scrolled");
  }

  /* --- Sidebar: rail (desktop/tablet) & drawer (mobile) --- */
  const isMobile = () => window.matchMedia("(max-width: 767.98px)").matches;

  function setPinned(pinned) {
    const shell = $("#app-shell");
    const btn = $('[data-action="toggle-sidebar"]');
    shell.classList.toggle("is-pinned", pinned);
    btn.setAttribute("aria-expanded", String(pinned));
    btn.setAttribute("aria-label", pinned ? "Ciutkan menu samping" : "Sematkan menu samping");
    storage.write(STORAGE_KEYS.sidebarPinned, pinned);
  }

  function openDrawer() {
    const shell = $("#app-shell");
    shell.classList.add("is-drawer-open");
    $(".sidebar-backdrop").hidden = false;
    $('[data-action="open-drawer"]').setAttribute("aria-expanded", "true");
    $("#app-main").inert = true;
    document.body.classList.add("is-locked");
    setTimeout(() => ($('[aria-current="page"].nav-item') || $(".nav-item"))?.focus(), 50);
  }

  function closeDrawer(returnFocus = true) {
    const shell = $("#app-shell");
    if (!shell.classList.contains("is-drawer-open")) return;
    shell.classList.remove("is-drawer-open");
    $(".sidebar-backdrop").hidden = true;
    $('[data-action="open-drawer"]').setAttribute("aria-expanded", "false");
    $("#app-main").inert = false;
    document.body.classList.remove("is-locked");
    if (returnFocus) $('[data-action="open-drawer"]').focus();
  }

  async function handleLogout() {
    closeDrawer(false);
    const ok = await confirmDialog();
    if (!ok) return;
    try {
      await logoutUser();
      showToast("Anda telah keluar dari akun.", "info");
      navigate("#/");
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  function setupShell() {
    setPinned(Boolean(storage.read(STORAGE_KEYS.sidebarPinned, false)));

    // Delegasi klik global untuk aksi umum
    document.addEventListener("click", (e) => {
      const scrollLink = e.target.closest("a[data-scroll]");
      if (scrollLink) {
        e.preventDefault();
        const id = scrollLink.getAttribute("href").slice(1);
        // Dari halaman lain: hash jangkar akan merender landing lalu menggulir.
        if (router.current !== "") location.hash = `#${id}`;
        else scrollToSection(id);
        return;
      }
      const el = e.target.closest("[data-action]");
      if (!el) return;
      switch (el.dataset.action) {
        case "view-report": {
          const holder = el.closest("[data-report-id]");
          if (holder) openReportFromUI(holder.dataset.reportId);
          break;
        }
        case "close-dialog":
          el.closest("dialog")?.close();
          break;
        case "toggle-sidebar":
          setPinned(!$("#app-shell").classList.contains("is-pinned"));
          break;
        case "open-drawer":
          openDrawer();
          break;
        case "close-drawer":
          closeDrawer();
          break;
        case "logout":
          handleLogout();
          break;
        case "toggle-site-nav":
          toggleSiteNav();
          break;
      }
    });

    // Tutup drawer setelah memilih menu (mobile)
    $("#sidebar").addEventListener("click", (e) => {
      if (e.target.closest("a.nav-item") && isMobile()) closeDrawer(false);
    });

    // Klik di luar menu landing (mobile) menutupnya
    document.addEventListener("click", (e) => {
      const nav = $("#site-nav");
      if (nav.classList.contains("is-open") && !e.target.closest("#site-nav, [data-action='toggle-site-nav']")) closeSiteNav();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if ($("#app-shell").classList.contains("is-drawer-open")) closeDrawer();
      if ($("#site-nav").classList.contains("is-open")) {
        closeSiteNav();
        $('[data-action="toggle-site-nav"]').focus();
      }
    });

    window.matchMedia("(min-width: 768px)").addEventListener("change", (e) => e.matches && closeDrawer(false));
    window.addEventListener("scroll", updateHeaderScroll, { passive: true });

    // Tautan lewati ke konten utama
    $("[data-skip]").addEventListener("click", (e) => {
      e.preventDefault();
      const route = ROUTES[router.current] || NOT_FOUND;
      const view = $(LAYOUTS[route.layout].view);
      (view.querySelector("h1") || view).focus();
    });

    // Dialog detail: tutup lewat backdrop & kembalikan URL
    const reportDialog = $("#report-dialog");
    reportDialog.addEventListener("click", (e) => {
      if (e.target === reportDialog) reportDialog.close();
    });
    reportDialog.addEventListener("close", () => {
      detailToken++;
      if (router.closingByRoute) {
        router.closingByRoute = false;
        return;
      }
      if (location.hash.startsWith("#/laporan/")) {
        if (router.detailPushed) {
          router.detailPushed = false;
          history.back();
        } else navigate(router.returnHash, { replace: true });
      }
    });
    $("#profile-dialog").addEventListener("click", (e) => {
      if (e.target === e.currentTarget) e.currentTarget.close();
    });

    // Gambar gagal dimuat → gambar cadangan / inisial
    document.addEventListener(
      "error",
      (e) => {
        const img = e.target;
        if (!(img instanceof HTMLImageElement) || !img.hasAttribute("data-fallback") || img.dataset.failed) return;
        img.dataset.failed = "1";
        if (img.dataset.fallback === "hide") {
          img.style.visibility = "hidden"; // latar navy tetap tampil
        } else if (img.dataset.fallback === "initials") {
          const span = document.createElement("span");
          span.setAttribute("aria-hidden", "true");
          span.textContent = img.dataset.initials || "?";
          img.replaceWith(span);
        } else img.src = PLACEHOLDER_IMG;
      },
      true
    );

    setupProfileDialog();
  }

  /* ========================================================================
     9. INISIALISASI
     ======================================================================== */
  function init() {
    loadState();
    setupShell();
    window.addEventListener("hashchange", handleRoute);
    handleRoute();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

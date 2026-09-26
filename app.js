/* =====================================================
   SUPABASE
===================================================== */

const SUPABASE_URL =
    "https://hwzyfzsuabphminlhvqw.supabase.co";

const SUPABASE_ANON_KEY =
    "sb_publishable_zoje27FnGfWpCIFfeZaTnA_Q0AgM5y-";

const db = supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
);


/* =====================================================
   VARIABLE
===================================================== */

let user = null;

let month = new Date();

let members = [];
let payments = [];
let expenses = [];

let setting = {
    monthly_amount: 5000
};


/* =====================================================
   HELPER
===================================================== */

const $ = id =>
    document.getElementById(id);


const money = number =>
    new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        maximumFractionDigits: 0
    }).format(Number(number) || 0);


function localDate(date) {

    date = new Date(date);

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}-${String(
        date.getDate()
    ).padStart(2, "0")}`;
}


function key(date) {

    return `${date.getFullYear()}-${String(
        date.getMonth() + 1
    ).padStart(2, "0")}`;
}


function range(date) {

    return {
        s: `${date.getFullYear()}-${String(
            date.getMonth() + 1
        ).padStart(2, "0")}-01`,

        e: localDate(
            new Date(
                date.getFullYear(),
                date.getMonth() + 1,
                0
            )
        )
    };
}


function fmt(date) {

    if (!date) return "-";

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(
        new Date(date + "T00:00:00")
    );
}


function monthName(date) {

    return new Intl.DateTimeFormat(
        "id-ID",
        {
            month: "long",
            year: "numeric"
        }
    ).format(date);
}


function esc(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]
    );
}


/* =====================================================
   TOAST
===================================================== */

function toast(message) {

    const container = $("toast");

    container.innerHTML = `
        <div
            class="toast show"
            role="alert"
        >
            <div class="toast-body">
                ${esc(message)}
            </div>
        </div>
    `;

    setTimeout(() => {

        container.innerHTML = "";

    }, 2500);
}


/* =====================================================
   AUTH
===================================================== */

function toggleAuth(showLogin) {

    $("login").classList.toggle(
        "d-none",
        !showLogin
    );

    $("register").classList.toggle(
        "d-none",
        showLogin
    );

    $("msg").textContent = "";
}


async function login() {

    const email =
        $("le").value.trim();

    const password =
        $("lp").value;

    if (!email || !password) {

        $("msg").textContent =
            "Email dan password wajib diisi.";

        return;
    }

    const { error } =
        await db.auth.signInWithPassword({
            email,
            password
        });

    if (error) {

        $("msg").textContent =
            error.message;
    }
}


async function register() {

    const email =
        $("re").value.trim();

    const password =
        $("rp").value;

    if (!email || !password) {

        $("msg").textContent =
            "Email dan password wajib diisi.";

        return;
    }

    if (password.length < 6) {

        $("msg").textContent =
            "Password minimal 6 karakter.";

        return;
    }

    const { error } =
        await db.auth.signUp({
            email,
            password
        });

    $("msg").textContent =
        error
            ? error.message
            : "Pendaftaran berhasil. Cek email jika verifikasi diminta.";
}


async function logout() {

    await db.auth.signOut();
}


/* =====================================================
   TAMPILKAN APP
===================================================== */

async function show(userData) {

    if (!userData) return;

    user = userData;

    $("auth").classList.add("d-none");

    $("app").classList.remove("d-none");

    $("email").textContent =
        user.email || "";

    await load();
}


/* =====================================================
   LOAD DATA BULAN AKTIF
===================================================== */

async function load() {

    if (!user) return;

    const r = range(month);

    $("monthTitle").textContent =
        monthName(month);


    const [
        memberResult,
        paymentResult,
        expenseResult,
        settingResult
    ] = await Promise.all([

        db
            .from("members")
            .select("*")
            .order("name"),

        db
            .from("payments")
            .select("*")
            .gte("payment_date", r.s)
            .lte("payment_date", r.e),

        db
            .from("expenses")
            .select("*")
            .gte("expense_date", r.s)
            .lte("expense_date", r.e)
            .order("expense_date"),

        db
            .from("settings")
            .select("*")
            .maybeSingle()
    ]);


    const error =
        memberResult.error ||
        paymentResult.error ||
        expenseResult.error ||
        settingResult.error;


    if (error) {

        toast(error.message);

        return;
    }


    members =
        memberResult.data || [];

    payments =
        paymentResult.data || [];

    expenses =
        expenseResult.data || [];

    setting =
        settingResult.data || {
            monthly_amount: 5000
        };


    $("nominal").value =
        setting.monthly_amount;


    render();
}


/* =====================================================
   STATUS PEMBAYARAN
===================================================== */

function paymentState(payment) {

    const target =
        Number(setting.monthly_amount) || 0;

    const amount =
        Number(payment?.amount) || 0;


    if (amount <= 0) {

        return "unpaid";
    }


    if (amount >= target) {

        return "paid";
    }


    return "partial";
}


function paymentStatusText(state) {

    if (state === "paid") {

        return "SUDAH LUNAS";
    }

    if (state === "partial") {

        return "MASIH KURANG";
    }

    return "BELUM BAYAR";
}


/* =====================================================
   RENDER DATA
===================================================== */

function render() {

    const income =
        payments.reduce(
            (total, item) =>
                total + Number(item.amount || 0),
            0
        );


    const out =
        expenses.reduce(
            (total, item) =>
                total + Number(item.amount || 0),
            0
        );


    const fullPaid =
        members.filter(member => {

            const payment =
                payments.find(
                    item =>
                        item.member_id === member.id
                );

            return paymentState(payment) === "paid";

        }).length;


    const notFull =
        members.length - fullPaid;


    $("income").textContent =
        money(income);

    $("out").textContent =
        money(out);

    $("saldo").textContent =
        money(income - out);

    $("count").textContent =
        members.length;

    $("paid").textContent =
        fullPaid;

    $("unpaid").textContent =
        `${notFull} belum lunas`;

    $("expenseCount").textContent =
        `${expenses.length} transaksi`;


    /* ================================================
       TABLE ANGGOTA
    ================================================= */

    if (!members.length) {

        $("members").innerHTML = `
            <tr>
                <td
                    colspan="7"
                    class="empty-cell"
                >
                    Belum ada anggota.
                </td>
            </tr>
        `;

    } else {

        $("members").innerHTML =
            members.map((member, index) => {

                const payment =
                    payments.find(
                        item =>
                            item.member_id === member.id
                    );


                const state =
                    paymentState(payment);


                const status =
                    paymentStatusText(state);


                const target =
                    Number(setting.monthly_amount) || 0;


                const amount =
                    Number(payment?.amount) || 0;


                const kurang =
                    Math.max(
                        target - amount,
                        0
                    );


                let rowClass = "";

                let badgeClass = "";


                if (state === "paid") {

                    rowClass = "table-success";

                    badgeClass =
                        "text-bg-success";

                } else if (state === "partial") {

                    rowClass = "table-warning";

                    badgeClass =
                        "text-bg-warning";

                } else {

                    rowClass = "table-danger";

                    badgeClass =
                        "text-bg-danger";
                }


                return `
                    <tr class="${rowClass}">

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            <strong>
                                ${esc(member.name)}
                            </strong>
                        </td>

                        <td>

                            <span
                                class="badge ${badgeClass}"
                            >
                                ${status}
                            </span>

                            ${
                                state === "partial"
                                    ? `
                                        <div class="payment-help">
                                            Kurang
                                            ${money(kurang)}
                                        </div>
                                    `
                                    : ""
                            }

                        </td>

                        <td>
                            ${
                                payment
                                    ? money(amount)
                                    : "-"
                            }
                        </td>

                        <td>
                            ${
                                payment
                                    ? fmt(payment.payment_date)
                                    : "-"
                            }
                        </td>

                        <td>

                            <div class="row-actions">

                                ${
                                    payment
                                        ? `
                                            <button
                                                class="btn btn-sm btn-outline-primary"
                                                onclick="paymentForm('${member.id}','${payment.id}')"
                                            >
                                                Edit
                                            </button>

                                            <button
                                                class="btn btn-sm btn-outline-danger"
                                                onclick="delPayment('${payment.id}')"
                                            >
                                                Hapus
                                            </button>
                                        `
                                        : `
                                            <button
                                                class="btn btn-sm btn-success"
                                                onclick="paymentForm('${member.id}')"
                                            >
                                                Bayar
                                            </button>
                                        `
                                }

                            </div>

                        </td>

                        <td>

                            <div class="row-actions">

                                <button
                                    class="btn btn-sm btn-outline-primary"
                                    onclick="memberForm('${member.id}')"
                                >
                                    Edit
                                </button>

                                <button
                                    class="btn btn-sm btn-outline-danger"
                                    onclick="delMember('${member.id}')"
                                >
                                    Hapus
                                </button>

                            </div>

                        </td>

                    </tr>
                `;

            }).join("");
    }


    /* ================================================
       TABLE PENGELUARAN
    ================================================= */

    if (!expenses.length) {

        $("expenses").innerHTML = `
            <tr>
                <td
                    colspan="5"
                    class="empty-cell"
                >
                    Belum ada pengeluaran.
                </td>
            </tr>
        `;

    } else {

        $("expenses").innerHTML =
            expenses.map((item, index) => {

                return `
                    <tr>

                        <td>
                            ${index + 1}
                        </td>

                        <td>
                            ${fmt(item.expense_date)}
                        </td>

                        <td>
                            ${esc(item.description)}
                        </td>

                        <td>
                            <strong>
                                ${money(item.amount)}
                            </strong>
                        </td>

                        <td>

                            <div class="row-actions">

                                <button
                                    class="btn btn-sm btn-outline-primary"
                                    onclick="expenseForm('${item.id}')"
                                >
                                    Edit
                                </button>

                                <button
                                    class="btn btn-sm btn-outline-danger"
                                    onclick="delExpense('${item.id}')"
                                >
                                    Hapus
                                </button>

                            </div>

                        </td>

                    </tr>
                `;

            }).join("");
    }
}


/* =====================================================
   MODAL BOOTSTRAP
===================================================== */

function open(title, body) {

    $("modalTitle").textContent =
        title;

    $("modalBody").innerHTML =
        body;


    const modalElement =
        $("modal");


    const modal =
        bootstrap.Modal.getOrCreateInstance(
            modalElement
        );


    modal.show();
}


function closeModal() {

    const modalElement =
        $("modal");


    const modal =
        bootstrap.Modal.getInstance(
            modalElement
        );


    if (modal) {

        modal.hide();
    }
}


/* =====================================================
   ANGGOTA
===================================================== */

function memberForm(id = "") {

    const member =
        members.find(
            item => item.id === id
        );


    open(
        id
            ? "Edit Anggota"
            : "Tambah Anggota",

        `
            <div class="mb-3">

                <label class="form-label">
                    Nama anggota
                </label>

                <input
                    id="mn"
                    type="text"
                    class="form-control"
                    value="${member ? esc(member.name) : ""}"
                    placeholder="Nama anggota"
                >

            </div>

            <div class="d-flex justify-content-end gap-2">

                <button
                    class="btn btn-secondary"
                    onclick="closeModal()"
                >
                    Batal
                </button>

                <button
                    class="btn btn-primary"
                    onclick="saveMember('${id}')"
                >
                    Simpan
                </button>

            </div>
        `
    );
}


async function saveMember(id) {

    const name =
        $("mn").value.trim();


    if (!name) {

        toast("Nama wajib diisi.");

        return;
    }


    const query = id

        ? db
            .from("members")
            .update({ name })
            .eq("id", id)
            .eq("user_id", user.id)

        : db
            .from("members")
            .insert({
                name,
                user_id: user.id
            });


    const { error } =
        await query;


    if (error) {

        toast(error.message);

        return;
    }


    closeModal();

    await load();
}


async function delMember(id) {

    if (
        !confirm(
            "Hapus anggota? Riwayat pembayaran anggota ini juga akan terhapus."
        )
    ) {

        return;
    }


    const { error } =
        await db
            .from("members")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);


    if (error) {

        toast(error.message);

        return;
    }


    await load();
}


/* =====================================================
   PEMBAYARAN
===================================================== */

function paymentForm(
    memberId = "",
    paymentId = ""
) {

    const payment =
        payments.find(
            item => item.id === paymentId
        );


    const selected =
        payment
            ? payment.member_id
            : memberId;


    const options =
        members.length

            ? members.map(member => `
                <option
                    value="${member.id}"
                    ${member.id === selected ? "selected" : ""}
                >
                    ${esc(member.name)}
                </option>
            `).join("")

            : `
                <option value="">
                    Belum ada anggota
                </option>
            `;


    const amount =
        payment
            ? Number(payment.amount)
            : Number(setting.monthly_amount) || 5000;


    open(

        paymentId
            ? "Edit Pembayaran"
            : "Catat Pembayaran",

        `
            <div class="mb-3">

                <label class="form-label">
                    Anggota
                </label>

                <select
                    id="pm"
                    class="form-select"
                >
                    ${options}
                </select>

            </div>


            <div class="mb-3">

                <label class="form-label">
                    Tanggal
                </label>

                <input
                    id="pd"
                    type="date"
                    class="form-control"
                    value="${
                        payment
                            ? payment.payment_date
                            : localDate(new Date())
                    }"
                >

            </div>


            <div class="mb-3">

                <label class="form-label">
                    Jumlah
                </label>

                <input
                    id="pa"
                    type="number"
                    min="1"
                    class="form-control"
                    value="${amount}"
                >

                <div class="payment-help">
                    Nominal kas bulan ini:
                    <strong>
                        ${money(setting.monthly_amount)}
                    </strong>
                </div>

                <div id="paymentNotice"></div>

            </div>


            <div class="d-flex justify-content-end gap-2">

                <button
                    class="btn btn-secondary"
                    onclick="closeModal()"
                >
                    Batal
                </button>

                <button
                    class="btn btn-success"
                    onclick="savePayment('${paymentId}')"
                >
                    Simpan
                </button>

            </div>
        `
    );


    updatePaymentNotice();


    $("pa").addEventListener(
        "input",
        updatePaymentNotice
    );
}


function updatePaymentNotice() {

    const input =
        $("pa");

    const notice =
        $("paymentNotice");


    if (!input || !notice) return;


    const target =
        Number(setting.monthly_amount) || 0;

    const amount =
        Number(input.value) || 0;


    if (
        amount > 0 &&
        amount < target
    ) {

        notice.innerHTML = `
            <div class="payment-warning">
                Pembayaran masih kurang
                <strong>
                    ${money(target - amount)}
                </strong>.
            </div>
        `;

    } else if (
        amount >= target &&
        target > 0
    ) {

        notice.innerHTML = `
            <div class="text-success small">
                <i class="bi bi-check-circle"></i>
                Pembayaran sudah mencapai nominal kas.
            </div>
        `;

    } else {

        notice.innerHTML = "";
    }
}


async function savePayment(paymentId) {

    const member_id =
        $("pm").value;

    const payment_date =
        $("pd").value;

    const amount =
        Number($("pa").value);


    if (
        !member_id ||
        !payment_date ||
        amount <= 0
    ) {

        toast("Lengkapi data pembayaran.");

        return;
    }


    const duplicate =
        payments.some(
            item =>
                item.member_id === member_id &&
                item.id !== paymentId
        );


    if (duplicate) {

        toast(
            "Anggota sudah memiliki pembayaran bulan ini. Gunakan Edit."
        );

        return;
    }


    const data = {
        member_id,
        payment_date,
        amount,
        user_id: user.id,
        month: key(month)
    };


    const query = paymentId

        ? db
            .from("payments")
            .update({
                member_id,
                payment_date,
                amount
            })
            .eq("id", paymentId)
            .eq("user_id", user.id)

        : db
            .from("payments")
            .insert(data);


    const { error } =
        await query;


    if (error) {

        toast(error.message);

        return;
    }


    closeModal();

    await load();
}


async function delPayment(id) {

    if (!confirm("Hapus pembayaran?")) {

        return;
    }


    const { error } =
        await db
            .from("payments")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);


    if (error) {

        toast(error.message);

        return;
    }


    await load();
}


/* =====================================================
   PENGELUARAN
===================================================== */

function expenseForm(id = "") {

    const expense =
        expenses.find(
            item => item.id === id
        );


    open(

        id
            ? "Edit Pengeluaran"
            : "Tambah Pengeluaran",

        `
            <div class="mb-3">

                <label class="form-label">
                    Tanggal
                </label>

                <input
                    id="ed"
                    type="date"
                    class="form-control"
                    value="${
                        expense
                            ? expense.expense_date
                            : localDate(new Date())
                    }"
                >

            </div>


            <div class="mb-3">

                <label class="form-label">
                    Keterangan
                </label>

                <input
                    id="ex"
                    type="text"
                    class="form-control"
                    value="${
                        expense
                            ? esc(expense.description)
                            : ""
                    }"
                    placeholder="Contoh: beli air mineral"
                >

            </div>


            <div class="mb-3">

                <label class="form-label">
                    Jumlah
                </label>

                <input
                    id="ea"
                    type="number"
                    min="1"
                    class="form-control"
                    value="${
                        expense
                            ? expense.amount
                            : ""
                    }"
                    placeholder="Contoh: 20000"
                >

            </div>


            <div class="d-flex justify-content-end gap-2">

                <button
                    class="btn btn-secondary"
                    onclick="closeModal()"
                >
                    Batal
                </button>

                <button
                    class="btn btn-warning"
                    onclick="saveExpense('${id}')"
                >
                    Simpan
                </button>

            </div>
        `
    );
}


async function saveExpense(id) {

    const expense_date =
        $("ed").value;

    const description =
        $("ex").value.trim();

    const amount =
        Number($("ea").value);


    if (
        !expense_date ||
        !description ||
        amount <= 0
    ) {

        toast("Lengkapi data pengeluaran.");

        return;
    }


    const query = id

        ? db
            .from("expenses")
            .update({
                expense_date,
                description,
                amount
            })
            .eq("id", id)
            .eq("user_id", user.id)

        : db
            .from("expenses")
            .insert({
                expense_date,
                description,
                amount,
                user_id: user.id
            });


    const { error } =
        await query;


    if (error) {

        toast(error.message);

        return;
    }


    closeModal();

    await load();
}


async function delExpense(id) {

    if (!confirm("Hapus pengeluaran?")) {

        return;
    }


    const { error } =
        await db
            .from("expenses")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id);


    if (error) {

        toast(error.message);

        return;
    }


    await load();
}


/* =====================================================
   SETTING NOMINAL
===================================================== */

async function saveSetting() {

    const monthly_amount =
        Number($("nominal").value);


    if (
        !Number.isFinite(monthly_amount) ||
        monthly_amount < 0
    ) {

        toast("Nominal tidak valid.");

        return;
    }


    const { error } =
        await db
            .from("settings")
            .upsert(
                {
                    user_id: user.id,
                    monthly_amount
                },
                {
                    onConflict: "user_id"
                }
            );


    if (error) {

        toast(error.message);

        return;
    }


    setting.monthly_amount =
        monthly_amount;


    render();

    toast("Nominal kas berhasil disimpan.");
}


/* =====================================================
   PINDAH BULAN
===================================================== */

function moveMonth(number) {

    month =
        new Date(
            month.getFullYear(),
            month.getMonth() + number,
            1
        );

    load();
}


function todayMonth() {

    month = new Date();

    load();
}


/* =====================================================
   DATA UNTUK LAPORAN SATU BULAN
===================================================== */

function makeMonthRows(
    targetMonth,
    monthMembers,
    monthPayments,
    targetAmount
) {

    return monthMembers.map(
        (member, index) => {

            const payment =
                monthPayments.find(
                    item =>
                        item.member_id === member.id
                );


            const amount =
                Number(payment?.amount) || 0;


            let status =
                "BELUM BAYAR";


            let shortage = 0;


            if (amount >= targetAmount && targetAmount > 0) {

                status =
                    "SUDAH LUNAS";

            } else if (amount > 0) {

                status =
                    "MASIH KURANG";

                shortage =
                    targetAmount - amount;
            }


            return {

                No: index + 1,

                Nama: member.name,

                Bulan: monthName(targetMonth),

                "Target Kas":
                    targetAmount,

                "Jumlah Bayar":
                    amount,

                Status:
                    status,

                Kekurangan:
                    shortage,

                "Tanggal Bayar":
                    payment
                        ? payment.payment_date
                        : ""

            };
        }
    );
}


/* =====================================================
   DOWNLOAD FORM
===================================================== */

function downloadForm() {

    const current =
        `${month.getFullYear()}-${String(
            month.getMonth() + 1
        ).padStart(2, "0")}`;


    open(

        "Download Laporan Kas",

        `
            <div class="mb-3">

                <label class="form-label fw-semibold">
                    Dari bulan
                </label>

                <input
                    id="downloadStart"
                    type="month"
                    class="form-control"
                    value="${current}"
                >

            </div>


            <div class="mb-3">

                <label class="form-label fw-semibold">
                    Sampai bulan
                </label>

                <input
                    id="downloadEnd"
                    type="month"
                    class="form-control"
                    value="${current}"
                >

            </div>


            <div class="alert alert-info small">

                <i class="bi bi-info-circle me-1"></i>

                Semua data pada rentang bulan tersebut
                akan ikut didownload, termasuk:

                <ul class="mb-0 mt-2">

                    <li>Status pembayaran anggota</li>

                    <li>Jumlah pembayaran</li>

                    <li>Anggota yang belum bayar</li>

                    <li>Anggota yang masih kurang</li>

                    <li>Pengeluaran kas</li>

                    <li>Ringkasan pemasukan, pengeluaran dan saldo</li>

                </ul>

            </div>


            <div class="d-grid gap-2">

                <button
                    class="btn btn-danger"
                    onclick="downloadPdfRange()"
                >
                    <i class="bi bi-file-earmark-pdf me-1"></i>
                    Download PDF
                </button>

            </div>
        `
    );
}


/* =====================================================
   AMBIL DATA RENTANG BULAN
===================================================== */

function parseMonthInput(value) {

    if (!value) return null;

    const [year, monthNumber] =
        value.split("-").map(Number);


    return new Date(
        year,
        monthNumber - 1,
        1
    );
}


function monthRange(startMonth, endMonth) {

    const start =
        parseMonthInput(startMonth);

    const end =
        parseMonthInput(endMonth);


    if (!start || !end) {

        throw new Error(
            "Bulan belum dipilih."
        );
    }


    if (start > end) {

        throw new Error(
            "Bulan awal tidak boleh lebih besar dari bulan akhir."
        );
    }


    const startDate =
        `${start.getFullYear()}-${String(
            start.getMonth() + 1
        ).padStart(2, "0")}-01`;


    const endDate =
        localDate(
            new Date(
                end.getFullYear(),
                end.getMonth() + 1,
                0
            )
        );


    return {
        start,
        end,
        startDate,
        endDate
    };
}


async function getRangeData(
    startMonth,
    endMonth
) {

    const r =
        monthRange(
            startMonth,
            endMonth
        );


    const [
        memberResult,
        paymentResult,
        expenseResult,
        settingResult
    ] = await Promise.all([

        db
            .from("members")
            .select("*")
            .order("name"),

        db
            .from("payments")
            .select("*")
            .gte("payment_date", r.startDate)
            .lte("payment_date", r.endDate)
            .order("payment_date"),

        db
            .from("expenses")
            .select("*")
            .gte("expense_date", r.startDate)
            .lte("expense_date", r.endDate)
            .order("expense_date"),

        db
            .from("settings")
            .select("*")
            .maybeSingle()
    ]);


    const error =
        memberResult.error ||
        paymentResult.error ||
        expenseResult.error ||
        settingResult.error;


    if (error) {

        throw new Error(
            error.message
        );
    }


    return {

        ...r,

        members:
            memberResult.data || [],

        payments:
            paymentResult.data || [],

        expenses:
            expenseResult.data || [],

        setting:
            settingResult.data || {
                monthly_amount: 5000
            }

    };
}


/* =====================================================
   DATA PER BULAN
===================================================== */

function buildMonthlyData(
    data,
    targetMonth
) {

    const start =
        new Date(
            targetMonth.getFullYear(),
            targetMonth.getMonth(),
            1
        );


    const end =
        new Date(
            targetMonth.getFullYear(),
            targetMonth.getMonth() + 1,
            0
        );


    const startDate =
        localDate(start);

    const endDate =
        localDate(end);


    const monthPayments =
        data.payments.filter(
            payment =>
                payment.payment_date >= startDate &&
                payment.payment_date <= endDate
        );


    const monthExpenses =
        data.expenses.filter(
            expense =>
                expense.expense_date >= startDate &&
                expense.expense_date <= endDate
        );


    const targetAmount =
        Number(
            data.setting.monthly_amount
        ) || 0;


    const statusRows =
        makeMonthRows(
            targetMonth,
            data.members,
            monthPayments,
            targetAmount
        );


    const income =
        monthPayments.reduce(
            (total, item) =>
                total + Number(item.amount || 0),
            0
        );


    const out =
        monthExpenses.reduce(
            (total, item) =>
                total + Number(item.amount || 0),
            0
        );


    return {

        month: targetMonth,

        payments:
            monthPayments,

        expenses:
            monthExpenses,

        statusRows,

        income,

        out,

        saldo:
            income - out
    };
}


/* =====================================================
   EXCEL
===================================================== */

async function downloadExcelRange() {

    try {

        const startMonth =
            $("downloadStart").value;

        const endMonth =
            $("downloadEnd").value;


        const data =
            await getRangeData(
                startMonth,
                endMonth
            );


        const wb =
            XLSX.utils.book_new();


        const allStatus = [];

        const allExpenses = [];

        const summary = [];


        let current =
            new Date(
                data.start
            );


        while (
            current <= data.end
        ) {

            const monthly =
                buildMonthlyData(
                    data,
                    current
                );


            /* STATUS */

            monthly.statusRows.forEach(
                row => {

                    allStatus.push({
                        Bulan: row.Bulan,
                        No: row.No,
                        Nama: row.Nama,
                        "Target Kas":
                            row["Target Kas"],
                        "Jumlah Bayar":
                            row["Jumlah Bayar"],
                        Status:
                            row.Status,
                        Kekurangan:
                            row.Kekurangan,
                        "Tanggal Bayar":
                            row["Tanggal Bayar"]
                    });

                }
            );


            /* PENGELUARAN */

            monthly.expenses.forEach(
                (expense, index) => {

                    allExpenses.push({

                        Bulan:
                            monthName(
                                monthly.month
                            ),

                        No:
                            index + 1,

                        Tanggal:
                            expense.expense_date,

                        Keterangan:
                            expense.description,

                        Jumlah:
                            Number(
                                expense.amount
                            )

                    });

                }
            );


            /* RINGKASAN */

            const paid =
                monthly.statusRows.filter(
                    row =>
                        row.Status ===
                        "SUDAH LUNAS"
                ).length;


            const partial =
                monthly.statusRows.filter(
                    row =>
                        row.Status ===
                        "MASIH KURANG"
                ).length;


            const unpaid =
                monthly.statusRows.filter(
                    row =>
                        row.Status ===
                        "BELUM BAYAR"
                ).length;


            summary.push({

                Bulan:
                    monthName(
                        monthly.month
                    ),

                "Total Anggota":
                    data.members.length,

                "Sudah Lunas":
                    paid,

                "Masih Kurang":
                    partial,

                "Belum Bayar":
                    unpaid,

                Pemasukan:
                    monthly.income,

                Pengeluaran:
                    monthly.out,

                Saldo:
                    monthly.saldo

            });


            current =
                new Date(
                    current.getFullYear(),
                    current.getMonth() + 1,
                    1
                );
        }


        /* SHEET STATUS */

        const statusSheet =
            XLSX.utils.json_to_sheet(
                allStatus
            );


        /* SHEET PENGELUARAN */

        const expenseSheet =
            XLSX.utils.json_to_sheet(
                allExpenses
            );


        /* SHEET RINGKASAN */

        const summarySheet =
            XLSX.utils.json_to_sheet(
                summary
            );


        XLSX.utils.book_append_sheet(
            wb,
            statusSheet,
            "Status Pembayaran"
        );


        XLSX.utils.book_append_sheet(
            wb,
            expenseSheet,
            "Pengeluaran"
        );


        XLSX.utils.book_append_sheet(
            wb,
            summarySheet,
            "Ringkasan"
        );


        const filename =
            `Laporan-Kas-${startMonth}-sampai-${endMonth}.xlsx`;


        XLSX.writeFile(
            wb,
            filename
        );


        closeModal();

        toast(
            "Excel berhasil didownload."
        );

    } catch (error) {

        toast(error.message);
    }
}


/* =====================================================
   PDF
===================================================== */

async function downloadPdfRange() {

    try {

        const startMonth =
            $("downloadStart").value;

        const endMonth =
            $("downloadEnd").value;


        const data =
            await getRangeData(
                startMonth,
                endMonth
            );


        const {
            jsPDF
        } = window.jspdf;


        const pdf =
            new jsPDF(
                "p",
                "mm",
                "a4"
            );


        let current =
            new Date(
                data.start
            );


        let firstPage = true;


        while (
            current <= data.end
        ) {

            const monthly =
                buildMonthlyData(
                    data,
                    current
                );


            if (!firstPage) {

                pdf.addPage();
            }


            firstPage = false;


            /* JUDUL */

            pdf.setFontSize(16);

            pdf.text(
                "LAPORAN KAS BULANAN",
                14,
                18
            );


            pdf.setFontSize(11);

            pdf.text(
                monthName(
                    monthly.month
                ),
                14,
                26
            );


            pdf.text(
                `Pemasukan: ${money(monthly.income)}`,
                14,
                34
            );


            pdf.text(
                `Pengeluaran: ${money(monthly.out)}`,
                14,
                41
            );


            pdf.text(
                `Saldo: ${money(monthly.saldo)}`,
                14,
                48
            );


            /* STATUS */

            pdf.autoTable({

                startY: 55,

                head: [[
                    "No",
                    "Nama",
                    "Status",
                    "Jumlah",
                    "Kurang",
                    "Tanggal"
                ]],

                body:
                    monthly.statusRows.map(
                        row => [

                            row.No,

                            row.Nama,

                            row.Status,

                            money(
                                row["Jumlah Bayar"]
                            ),

                            row.Kekurangan > 0
                                ? money(
                                    row.Kekurangan
                                )
                                : "-",

                            row["Tanggal Bayar"]
                                ? fmt(
                                    row["Tanggal Bayar"]
                                )
                                : "-"

                        ]
                    ),

                styles: {
                    fontSize: 8
                },

                headStyles: {
                    fillColor: [
                        13,
                        110,
                        253
                    ]
                }

            });


            /* PENGELUARAN */

            const expenseStart =
                pdf.lastAutoTable.finalY + 10;


            pdf.setFontSize(11);

            pdf.text(
                "Pengeluaran",
                14,
                expenseStart
            );


            pdf.autoTable({

                startY:
                    expenseStart + 5,

                head: [[
                    "No",
                    "Tanggal",
                    "Keterangan",
                    "Jumlah"
                ]],

                body:
                    monthly.expenses.map(
                        (expense, index) => [

                            index + 1,

                            fmt(
                                expense.expense_date
                            ),

                            expense.description,

                            money(
                                expense.amount
                            )

                        ]
                    ),

                styles: {
                    fontSize: 8
                },

                headStyles: {
                    fillColor: [
                        220,
                        53,
                        69
                    ]
                }

            });


            current =
                new Date(
                    current.getFullYear(),
                    current.getMonth() + 1,
                    1
                );
        }


        pdf.save(
            `Laporan-Kas-${startMonth}-sampai-${endMonth}.pdf`
        );


        closeModal();

        toast(
            "PDF berhasil didownload."
        );


    } catch (error) {

        toast(error.message);
    }
}


/* =====================================================
   AUTH STATE
===================================================== */

let initializing = true;


async function init() {

    const {
        data: {
            session
        }
    } =
        await db.auth.getSession();


    initializing = false;


    if (session) {

        await show(
            session.user
        );
    }
}


db.auth.onAuthStateChange(
    async (event, session) => {

        if (initializing) return;


        if (
            event === "SIGNED_IN" &&
            session
        ) {

            await show(
                session.user
            );
        }


        if (
            event === "SIGNED_OUT"
        ) {

            user = null;

            $("app")
                .classList
                .add("d-none");

            $("auth")
                .classList
                .remove("d-none");

            toggleAuth(true);
        }

    }
);


/* =====================================================
   START
===================================================== */

init();
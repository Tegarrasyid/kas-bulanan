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
let currentEditingPaymentId = null;

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

    members = memberResult.data || [];
    payments = paymentResult.data || [];
    expenses = expenseResult.data || [];

    setting = settingResult.data || {
        monthly_amount: 5000
    };

    $("nominal").value =
        setting.monthly_amount;

    render();
}

function paymentTotal(payment) {
    return (
        Number(payment?.amount) || 0
    ) + (
        Number(payment?.carryover_amount) || 0
    );
}

function paymentCarryover(payment) {
    return Number(payment?.carryover_amount) || 0;
}


/* =====================================================
   STATUS PEMBAYARAN
===================================================== */

function paymentState(payment) {

    const target =
        Number(setting.monthly_amount) || 0;

    const amount =
        paymentTotal(payment);


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
            const payment = payments.find(
                item => item.member_id === member.id
            );

            return paymentState(payment) === "paid";
        }).length;

    const notFull =
        members.length - fullPaid;

    $("income").textContent = money(income);
    $("out").textContent = money(out);
    $("saldo").textContent = money(income - out);
    $("count").textContent = members.length;
    $("paid").textContent = fullPaid;
    $("unpaid").textContent = `${notFull} belum lunas`;
    $("expenseCount").textContent = `${expenses.length} transaksi`;

    if (!members.length) {
        $("members").innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">
                    Belum ada anggota.
                </td>
            </tr>
        `;
    } else {
        $("members").innerHTML = members.map((member, index) => {

            const payment = payments.find(
                item => item.member_id === member.id
            );

            const state = paymentState(payment);
            const status = paymentStatusText(state);
            const target = Number(setting.monthly_amount) || 0;
            const actualAmount = Number(payment?.amount) || 0;
            const carryover = paymentCarryover(payment);
            const total = paymentTotal(payment);
            const kurang = Math.max(target - total, 0);

            let rowClass = "";
            let badgeClass = "";

            if (state === "paid") {
                rowClass = "table-success";
                badgeClass = "text-bg-success";
            } else if (state === "partial") {
                rowClass = "table-warning";
                badgeClass = "text-bg-warning";
            } else {
                rowClass = "table-danger";
                badgeClass = "text-bg-danger";
            }

            const paymentDetail = payment
                ? `
                    <strong>${money(total)}</strong>
                    ${carryover > 0 ? `
                        <div class="payment-help">
                            Bayar ${money(actualAmount)} + sisa bulan lalu ${money(carryover)}
                        </div>
                    ` : ""}
                `
                : "-";

            return `
                <tr class="${rowClass}">
                    <td>${index + 1}</td>
                    <td><strong>${esc(member.name)}</strong></td>
                    <td>
                        <span class="badge ${badgeClass}">${status}</span>
                        ${state === "partial" ? `
                            <div class="payment-help">
                                Kurang ${money(kurang)}
                            </div>
                        ` : ""}
                    </td>
                    <td>${paymentDetail}</td>
                    <td>
                        ${payment?.payment_date && actualAmount > 0
                            ? fmt(payment.payment_date)
                            : (carryover > 0 ? "Dari bulan lalu" : "-")}
                    </td>
                    <td>
                        <div class="row-actions">
                            ${payment
                                ? `
                                    <button
                                        class="btn btn-sm btn-outline-primary"
                                        onclick="paymentForm('${member.id}','${payment.id}')"
                                    >
                                        ${actualAmount > 0 ? "Edit" : "Bayar"}
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
                                `}
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

    if (!expenses.length) {
        $("expenses").innerHTML = `
            <tr>
                <td colspan="5" class="empty-cell">
                    Belum ada pengeluaran.
                </td>
            </tr>
        `;
    } else {
        $("expenses").innerHTML = expenses.map((item, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${fmt(item.expense_date)}</td>
                <td>${esc(item.description)}</td>
                <td><strong>${money(item.amount)}</strong></td>
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
        `).join("");
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

    const payment = payments.find(
        item => item.id === paymentId
    );

    window.currentEditingPaymentId = paymentId;

    const selected = payment
        ? payment.member_id
        : memberId;

    const options = members.length
        ? members.map(member => `
            <option
                value="${member.id}"
                ${member.id === selected ? "selected" : ""}
            >
                ${esc(member.name)}
            </option>
        `).join("")
        : `
            <option value="">Belum ada anggota</option>
        `;

    const amount = payment
        ? Number(payment.amount) || 0
        : 0;

    const incomingCarryover =
        paymentCarryover(payment);

    open(
        paymentId ? "Edit Pembayaran" : "Catat Pembayaran",
        `
            <div class="mb-3">
                <label class="form-label">Anggota</label>
                <select id="pm" class="form-select" ${paymentId ? "disabled" : ""}>
                    ${options}
                </select>
            </div>

            <div class="mb-3">
                <label class="form-label">Tanggal</label>
                <input
                    id="pd"
                    type="date"
                    class="form-control"
                    value="${payment
                        ? payment.payment_date
                        : localDate(new Date())}"
                >
            </div>

            <div class="mb-3">
                <label class="form-label">Jumlah yang dibayar</label>
                <input
                    id="pa"
                    type="number"
                    min="1"
                    class="form-control"
                    value="${amount || ""}"
                    placeholder="Contoh: 5000"
                >

                <div class="payment-help mt-2">
                    Nominal kas bulan ini:
                    <strong>${money(setting.monthly_amount)}</strong>
                </div>

                ${incomingCarryover > 0 ? `
                    <div class="alert alert-info py-2 mt-2 mb-0 small">
                        <i class="bi bi-arrow-down-circle me-1"></i>
                        Ada sisa dari bulan lalu sebesar
                        <strong>${money(incomingCarryover)}</strong>.
                        Sisa ini otomatis dihitung untuk bulan ini.
                    </div>
                ` : ""}

                <div id="paymentNotice"></div>
            </div>

            <div class="d-flex justify-content-end gap-2">
                <button class="btn btn-secondary" onclick="closeModal()">
                    Batal
                </button>
                <button class="btn btn-success" onclick="savePayment('${paymentId}')">
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

    const input = $("pa");
    const notice = $("paymentNotice");

    if (!input || !notice) return;

    const target =
        Number(setting.monthly_amount) || 0;

    const amount =
        Number(input.value) || 0;

    const payment = payments.find(
        item => item.id === window.currentEditingPaymentId
    );

    const incomingCarryover =
        paymentCarryover(payment);

    const total =
        amount + incomingCarryover;

    const nextCarry =
        Math.max(total - target, 0);

    if (total > 0 && total < target) {
        notice.innerHTML = `
            <div class="payment-warning mt-2">
                Total untuk bulan ini
                <strong>${money(total)}</strong>.
                Masih kurang <strong>${money(target - total)}</strong>.
            </div>
        `;
    } else if (total >= target && target > 0) {
        const coveredMonths =
            Math.floor(total / target);

        notice.innerHTML = `
            <div class="text-success small mt-2">
                <i class="bi bi-check-circle"></i>
                Pembayaran ini cukup untuk
                <strong>${coveredMonths} bulan</strong>.
                ${nextCarry > 0
                    ? `Sisa <strong>${money(nextCarry)}</strong> akan otomatis diteruskan ke bulan-bulan berikutnya sampai habis.`
                    : "Tidak ada sisa untuk bulan berikutnya."}
            </div>
        `;
    } else {
        notice.innerHTML = "";
    }
}

async function recalculateMemberCarryovers(memberId) {

    const { data: rowsData, error: fetchError } =
        await db
            .from("payments")
            .select("*")
            .eq("user_id", user.id)
            .eq("member_id", memberId)
            .order("month");

    if (fetchError) throw fetchError;

    const rows = (rowsData || []).sort((a, b) =>
        String(a.month || "").localeCompare(
            String(b.month || "")
        )
    );

    if (!rows.length) return;

    const target =
        Number(setting.monthly_amount) || 0;

    /*
     * Rekonstruksi alur sisa pembayaran dari bulan paling awal.
     *
     * Contoh target Rp1.000 dan bayar Rp8.000:
     * September: tunai 8.000 + sisa 0     = 8.000 -> sisa 7.000
     * Oktober:   tunai 0 + sisa 7.000     = 7.000 -> sisa 6.000
     * November:  tunai 0 + sisa 6.000     = 6.000 -> sisa 5.000
     * dan seterusnya sampai sisa habis.
     *
     * Jadi satu pembayaran besar bisa otomatis menutup
     * beberapa bulan sekaligus.
     */

    let carryIntoMonth = 0;
    let currentMonth = rows[0].month
        ? parseMonthInput(rows[0].month)
        : null;

    if (!currentMonth) return;

    let rowIndex = 0;

    while (rowIndex < rows.length || carryIntoMonth > 0) {

        const currentKey = key(currentMonth);

        let payment =
            rows[rowIndex] &&
            rows[rowIndex].month === currentKey
                ? rows[rowIndex]
                : null;

        /*
         * Jika tidak ada pembayaran pada bulan ini tetapi masih ada
         * sisa, buat baris otomatis untuk bulan tersebut.
         */
        if (!payment && carryIntoMonth > 0) {

            const { data: inserted, error: insertError } =
                await db
                    .from("payments")
                    .insert({
                        member_id: memberId,
                        payment_date: localDate(currentMonth),
                        amount: 0,
                        carryover_amount: carryIntoMonth,
                        user_id: user.id,
                        month: currentKey
                    })
                    .select("*")
                    .single();

            if (insertError) throw insertError;

            payment = inserted;

            rows.splice(rowIndex, 0, payment);
        }

        /*
         * Jika tidak ada baris dan tidak ada sisa, lanjut ke
         * pembayaran historis berikutnya jika memang ada.
         */
        if (!payment) {

            if (rowIndex < rows.length) {
                currentMonth = new Date(
                    currentMonth.getFullYear(),
                    currentMonth.getMonth() + 1,
                    1
                );
                continue;
            }

            break;
        }

        const actualAmount =
            Number(payment.amount) || 0;

        const newCarryover =
            Math.max(carryIntoMonth, 0);

        /*
         * Baris otomatis yang sudah tidak mendapat sisa lagi
         * harus dihapus.
         */
        if (
            actualAmount <= 0 &&
            newCarryover <= 0
        ) {

            const { error: deleteError } =
                await db
                    .from("payments")
                    .delete()
                    .eq("id", payment.id)
                    .eq("user_id", user.id);

            if (deleteError) throw deleteError;

            rows.splice(rowIndex, 1);

            /*
             * Jangan menaikkan rowIndex karena array bergeser.
             * Setelah dihapus, tidak ada sisa untuk bulan berikutnya.
             */
            break;
        }

        if (
            Number(payment.carryover_amount || 0) !==
            newCarryover
        ) {

            const { error: updateError } =
                await db
                    .from("payments")
                    .update({
                        carryover_amount: newCarryover
                    })
                    .eq("id", payment.id)
                    .eq("user_id", user.id);

            if (updateError) throw updateError;

            payment.carryover_amount =
                newCarryover;
        }

        const total =
            actualAmount + newCarryover;

        const nextCarryover =
            Math.max(total - target, 0);

        rowIndex++;

        currentMonth = new Date(
            currentMonth.getFullYear(),
            currentMonth.getMonth() + 1,
            1
        );

        carryIntoMonth =
            nextCarryover;

        /*
         * Jika sudah tidak ada sisa, tetap lanjut memeriksa
         * baris historis berikutnya. Ini penting agar baris
         * auto-carryover lama yang sudah tidak diperlukan
         * bisa dibersihkan.
         */
    }
}


async function syncNextMonthCarryover(
    memberId,
    sourceMonth,
    carryoverAmount
) {

    /*
     * Setelah pembayaran berubah, bangun ulang seluruh rantai
     * sisa untuk anggota tersebut. Bukan hanya satu bulan.
     */
    await recalculateMemberCarryovers(memberId);
}


async function savePayment(paymentId) {

    const member_id = $("pm").value;
    const payment_date = $("pd").value;
    const amount = Number($("pa").value);

    if (!member_id || !payment_date || amount <= 0) {
        toast("Masukkan jumlah pembayaran yang valid.");
        return;
    }

    const oldPayment = paymentId
        ? payments.find(item => item.id === paymentId)
        : null;

    const duplicate = payments.some(
        item =>
            item.member_id === member_id &&
            item.id !== paymentId
    );

    if (duplicate) {
        toast("Anggota sudah memiliki catatan pembayaran bulan ini. Gunakan Edit.");
        return;
    }

    const incomingCarryover =
        paymentCarryover(oldPayment);

    const target =
        Number(setting.monthly_amount) || 0;

    const total =
        amount + incomingCarryover;

    const nextCarryover =
        Math.max(total - target, 0);

    const data = {
        member_id,
        payment_date,
        amount,
        carryover_amount: incomingCarryover,
        user_id: user.id,
        month: key(month)
    };

    const query = paymentId
        ? db
            .from("payments")
            .update({
                member_id,
                payment_date,
                amount,
                carryover_amount: incomingCarryover
            })
            .eq("id", paymentId)
            .eq("user_id", user.id)
        : db
            .from("payments")
            .insert(data);

    const { data: savedPayment, error } =
        await query.select("*").single();

    if (error) {
        toast(error.message);
        return;
    }

    try {
        await syncNextMonthCarryover(
            member_id,
            month,
            nextCarryover
        );

        if (
            oldPayment &&
            oldPayment.member_id !== member_id
        ) {
            await syncNextMonthCarryover(
                oldPayment.member_id,
                month,
                0
            );
        }
    } catch (carryError) {
        toast(`Pembayaran tersimpan, tetapi sisa bulan depan gagal diperbarui: ${carryError.message}`);
        await load();
        return;
    }

    window.currentEditingPaymentId = null;
    closeModal();
    await load();
}

async function delPayment(id) {

    if (!confirm("Hapus pembayaran? Jika ada sisa untuk bulan depan, sisa tersebut juga akan dibatalkan.")) {
        return;
    }

    const payment = payments.find(
        item => item.id === id
    );

    const { error } = await db
        .from("payments")
        .delete()
        .eq("id", id)
        .eq("user_id", user.id);

    if (error) {
        toast(error.message);
        return;
    }

    if (payment) {
        try {
            await syncNextMonthCarryover(
                payment.member_id,
                month,
                0
            );
        } catch (carryError) {
            toast(`Pembayaran dihapus, tetapi sisa bulan depan gagal diperbarui: ${carryError.message}`);
        }
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

async function recalculateAllCarryovers(targetAmount) {

    /*
     * Gunakan nominal baru untuk menghitung ulang seluruh
     * rantai sisa setiap anggota.
     */
    setting.monthly_amount = Number(targetAmount) || 0;

    const { data: allPayments, error } =
        await db
            .from("payments")
            .select("*")
            .eq("user_id", user.id)
            .order("member_id")
            .order("month");

    if (error) throw error;

    const memberIds = [
        ...new Set(
            (allPayments || [])
                .map(payment => payment.member_id)
                .filter(Boolean)
        )
    ];

    for (const memberId of memberIds) {
        await recalculateMemberCarryovers(memberId);
    }
}


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


    try {

        await recalculateAllCarryovers(
            monthly_amount
        );

    } catch (carryError) {

        toast(
            `Nominal berhasil disimpan, tetapi sisa pembayaran gagal disesuaikan: ${carryError.message}`
        );

        setting.monthly_amount =
            monthly_amount;

        await load();

        return;
    }


    setting.monthly_amount =
        monthly_amount;


    await load();

    toast(
        "Nominal kas berhasil disimpan dan sisa pembayaran sudah disesuaikan."
    );
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
                    item => item.member_id === member.id
                );

            const actualAmount =
                Number(payment?.amount) || 0;

            const carryover =
                paymentCarryover(payment);

            const amount =
                actualAmount + carryover;

            let status = "BELUM BAYAR";
            let shortage = 0;

            if (amount >= targetAmount && targetAmount > 0) {
                status = "SUDAH LUNAS";
            } else if (amount > 0) {
                status = "MASIH KURANG";
                shortage = targetAmount - amount;
            }

            return {
                No: index + 1,
                Nama: member.name,
                Bulan: monthName(targetMonth),
                "Target Kas": targetAmount,
                "Jumlah Bayar": actualAmount,
                "Sisa Bulan Lalu": carryover,
                "Total Dihitung": amount,
                Status: status,
                Kekurangan: shortage,
                "Tanggal Bayar": payment && actualAmount > 0
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
                    class="btn btn-success"
                    onclick="downloadExcelRange()"
                >
                    <i class="bi bi-file-earmark-excel me-1"></i>
                    Download Excel
                </button>

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
                        "Target Kas": row["Target Kas"],
                        "Bayar Tunai": row["Jumlah Bayar"],
                        "Sisa Bulan Lalu": row["Sisa Bulan Lalu"],
                        "Total Dihitung": row["Total Dihitung"],
                        Status: row.Status,
                        Kekurangan: row.Kekurangan,
                        "Tanggal Bayar": row["Tanggal Bayar"]
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
                    "Bayar Tunai",
                    "Sisa Lalu",
                    "Total",
                    "Kurang",
                    "Tanggal"
                ]],

                body:
                    monthly.statusRows.map(
                        row => [
                            row.No,
                            row.Nama,
                            row.Status,
                            money(row["Jumlah Bayar"]),
                            row["Sisa Bulan Lalu"] > 0
                                ? money(row["Sisa Bulan Lalu"])
                                : "-",
                            money(row["Total Dihitung"]),
                            row.Kekurangan > 0
                                ? money(row.Kekurangan)
                                : "-",
                            row["Tanggal Bayar"]
                                ? fmt(row["Tanggal Bayar"])
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
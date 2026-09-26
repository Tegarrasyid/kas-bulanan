const SUPABASE_URL="https://hwzyfzsuabphminlhvqw.supabase.co";
const SUPABASE_ANON_KEY="sb_publishable_zoje27FnGfWpCIFfeZaTnA_Q0AgM5y-";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_ANON_KEY);

let user=null,month=new Date(),members=[],payments=[],expenses=[],setting={monthly_amount:5000};
const $=x=>document.getElementById(x);
const money=n=>new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const localDate=d=>{d=new Date(d);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`};
const key=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
const range=d=>({s:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-01`,e:localDate(new Date(d.getFullYear(),d.getMonth()+1,0))});
const fmt=d=>new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(d+"T00:00:00"));
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#039;"}[c]));

function toast(x){
  $("toast").textContent=x;
  $("toast").classList.add("show");
  setTimeout(()=>$("toast").classList.remove("show"),2200);
}
function toggleAuth(login){
  $("login").classList.toggle("hide",!login);
  $("register").classList.toggle("hide",login);
  $("msg").textContent="";
}
async function login(){
  const {error}=await db.auth.signInWithPassword({email:$("le").value.trim(),password:$("lp").value});
  if(error)$("msg").textContent=error.message;
}
async function register(){
  const e=$("re").value.trim(),p=$("rp").value;
  if(p.length<6)return $("msg").textContent="Password minimal 6 karakter.";
  const {error}=await db.auth.signUp({email:e,password:p});
  $("msg").textContent=error?error.message:"Pendaftaran berhasil. Cek email jika verifikasi diminta.";
}
async function logout(){await db.auth.signOut()}
async function show(u){
  if(!u)return;
  user=u;
  $("auth").classList.add("hide");
  $("app").classList.remove("hide");
  $("email").textContent=u.email||"";
  await load();
}
async function load(){
  if(!user)return;
  const r=range(month);
  $("monthTitle").textContent=new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(month);

  const [m,p,e,s]=await Promise.all([
    db.from("members").select("*").order("name"),
    db.from("payments").select("*").gte("payment_date",r.s).lte("payment_date",r.e),
    db.from("expenses").select("*").gte("expense_date",r.s).lte("expense_date",r.e).order("expense_date"),
    db.from("settings").select("*").maybeSingle()
  ]);

  const err=m.error||p.error||e.error||s.error;
  if(err)return toast(err.message);

  members=m.data||[];
  payments=p.data||[];
  expenses=e.data||[];
  setting=s.data||{monthly_amount:5000};
  $("nominal").value=setting.monthly_amount;
  render();
}
function paymentState(p){
  const target=Number(setting.monthly_amount)||0;
  const amount=Number(p?.amount)||0;
  if(amount<=0)return "unpaid";
  if(amount>=target)return "paid";
  return "partial";
}
function paymentStatusText(state){
  if(state==="paid")return "SUDAH LUNAS";
  if(state==="partial")return "MASIH KURANG";
  return "BELUM BAYAR";
}
function render(){
  const inc=payments.reduce((a,x)=>a+Number(x.amount||0),0);
  const out=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
  const fullPaid=members.filter(m=>{
    const p=payments.find(x=>x.member_id===m.id);
    return paymentState(p)==="paid";
  }).length;
  const notFull=members.length-fullPaid;

  $("income").textContent=money(inc);
  $("out").textContent=money(out);
  $("saldo").textContent=money(inc-out);
  $("count").textContent=members.length;
  $("paid").textContent=fullPaid;
  $("unpaid").textContent=`${notFull} belum lunas`;
  $("expenseCount").textContent=`${expenses.length} transaksi`;

  $("members").innerHTML=members.length?members.map((m,i)=>{
    const p=payments.find(x=>x.member_id===m.id);
    const state=paymentState(p);
    const text=paymentStatusText(state);
    const target=Number(setting.monthly_amount)||0;
    const amount=Number(p?.amount)||0;
    const kurang=Math.max(target-amount,0);

    return `<tr class="${state}">
      <td>${i+1}</td>
      <td><b>${esc(m.name)}</b></td>
      <td>
        <span class="status ${state}">${text}</span>
        ${state==="partial"?`<div class="payment-help">Kurang ${money(kurang)}</div>`:""}
      </td>
      <td>${p?money(amount):"-"}</td>
      <td>${p?fmt(p.payment_date):"-"}</td>
      <td>
        <div class="action-group">
          <small>Pembayaran</small>
          <div class="row-actions">
            ${p?`<button class="edit-btn" onclick="paymentForm('${m.id}','${p.id}')">Edit</button><button class="delete-btn" onclick="delPayment('${p.id}')">Hapus</button>`:`<button class="pay-btn" onclick="paymentForm('${m.id}')">Bayar</button>`}
          </div>
        </div>
      </td>
      <td>
        <div class="action-group">
          <small>Anggota</small>
          <div class="row-actions">
            <button class="edit-btn" onclick="memberForm('${m.id}')">Edit</button>
            <button class="delete-btn" onclick="delMember('${m.id}')">Hapus</button>
          </div>
        </div>
      </td>
    </tr>`;
  }).join(""):`<tr><td colspan="7" class="empty-cell">Belum ada anggota.</td></tr>`;

  $("expenses").innerHTML=expenses.length?expenses.map((x,i)=>`<tr>
    <td>${i+1}</td><td>${fmt(x.expense_date)}</td><td>${esc(x.description)}</td><td><b>${money(x.amount)}</b></td>
    <td><div class="row-actions"><button onclick="expenseForm('${x.id}')">Edit</button><button onclick="delExpense('${x.id}')">Hapus</button></div></td>
  </tr>`).join(""):`<tr><td colspan="5" style="text-align:center">Belum ada pengeluaran.</td></tr>`;
}
function open(t,b){
  $("modalTitle").textContent=t;
  $("modalBody").innerHTML=`<div class="modal-body">${b}</div>`;
  $("modal").classList.remove("hide");
}
function closeModal(){$("modal").classList.add("hide")}

function memberForm(id=""){
  const m=members.find(x=>x.id===id);
  open(id?"Edit Anggota":"Tambah Anggota",`
    <label>Nama anggota</label>
    <input id="mn" value="${m?esc(m.name):""}" placeholder="Nama anggota">
    <div class="form-actions"><button onclick="closeModal()">Batal</button><button class="primary" onclick="saveMember('${id}')">Simpan</button></div>
  `);
}
async function saveMember(id){
  const name=$("mn").value.trim();
  if(!name)return toast("Nama wajib diisi.");
  const q=id?db.from("members").update({name}).eq("id",id).eq("user_id",user.id):db.from("members").insert({name,user_id:user.id});
  const {error}=await q;
  if(error)return toast(error.message);
  closeModal();await load();
}
async function delMember(id){
  if(!confirm("Hapus anggota? Riwayat bayarnya juga akan terhapus."))return;
  const {error}=await db.from("members").delete().eq("id",id).eq("user_id",user.id);
  if(error)toast(error.message);else await load();
}

function paymentForm(memberId="",pid=""){
  const p=payments.find(x=>x.id===pid);
  const selected=p?p.member_id:memberId;
  const options=members.length?members.map(m=>`<option value="${m.id}" ${m.id===selected?"selected":""}>${esc(m.name)}</option>`).join(""):`<option value="">Belum ada anggota</option>`;
  const currentAmount=p?Number(p.amount):Number(setting.monthly_amount)||0;

  open(pid?"Edit Pembayaran":"Catat Pembayaran",`
    <label>Anggota</label>
    <select id="pm">${options}</select>
    <label>Tanggal</label>
    <input id="pd" type="date" value="${p?p.payment_date:localDate(new Date())}">
    <label>Jumlah</label>
    <input id="pa" type="number" min="1" value="${currentAmount}">
    <div class="payment-help">Nominal kas bulan ini: <b>${money(setting.monthly_amount)}</b></div>
    <div id="paymentNotice"></div>
    <div class="form-actions"><button onclick="closeModal()">Batal</button><button class="green" onclick="savePayment('${pid}')">Simpan</button></div>
  `);
  updatePaymentNotice();
  $("pa").addEventListener("input",updatePaymentNotice);
}
function updatePaymentNotice(){
  const el=$("paymentNotice"),input=$("pa");
  if(!el||!input)return;
  const target=Number(setting.monthly_amount)||0,amount=Number(input.value)||0;
  if(amount>0&&amount<target)el.innerHTML=`<div class="payment-warning">Pembayaran masih kurang ${money(target-amount)} dari nominal kas.</div>`;
  else if(amount>=target)el.innerHTML=`<div class="payment-help">Pembayaran sudah mencapai nominal kas.</div>`;
  else el.innerHTML="";
}
async function savePayment(pid){
  const member_id=$("pm").value,payment_date=$("pd").value,amount=Number($("pa").value);
  if(!member_id||!payment_date||amount<=0)return toast("Lengkapi data.");
  if(payments.some(x=>x.member_id===member_id&&x.id!==pid))return toast("Anggota sudah memiliki pembayaran bulan ini. Gunakan Edit untuk mengubah jumlah.");
  const data={member_id,payment_date,amount,user_id:user.id,month:key(month)};
  const q=pid?db.from("payments").update({member_id,payment_date,amount}).eq("id",pid).eq("user_id",user.id):db.from("payments").insert(data);
  const {error}=await q;
  if(error)toast(error.message);else{closeModal();await load()}
}
async function delPayment(id){
  if(!confirm("Hapus pembayaran?"))return;
  const {error}=await db.from("payments").delete().eq("id",id).eq("user_id",user.id);
  if(error)toast(error.message);else await load();
}

function expenseForm(id=""){
  const x=expenses.find(e=>e.id===id);
  open(id?"Edit Pengeluaran":"Tambah Pengeluaran",`
    <label>Tanggal</label><input id="ed" type="date" value="${x?x.expense_date:localDate(new Date())}">
    <label>Keterangan</label><input id="ex" value="${x?esc(x.description):""}" placeholder="Contoh: beli air mineral">
    <label>Jumlah</label><input id="ea" type="number" min="1" value="${x?x.amount:""}">
    <div class="form-actions"><button onclick="closeModal()">Batal</button><button class="orange" onclick="saveExpense('${id}')">Simpan</button></div>
  `);
}
async function saveExpense(id){
  const expense_date=$("ed").value,description=$("ex").value.trim(),amount=Number($("ea").value);
  if(!expense_date||!description||amount<=0)return toast("Lengkapi data.");
  const q=id?db.from("expenses").update({expense_date,description,amount}).eq("id",id).eq("user_id",user.id):db.from("expenses").insert({expense_date,description,amount,user_id:user.id});
  const {error}=await q;
  if(error)toast(error.message);else{closeModal();await load()}
}
async function delExpense(id){
  if(!confirm("Hapus pengeluaran?"))return;
  const {error}=await db.from("expenses").delete().eq("id",id).eq("user_id",user.id);
  if(error)toast(error.message);else await load();
}
async function saveSetting(){
  const monthly_amount=Number($("nominal").value);
  if(!Number.isFinite(monthly_amount)||monthly_amount<0)return toast("Nominal tidak valid.");
  const {error}=await db.from("settings").upsert({user_id:user.id,monthly_amount},{onConflict:"user_id"});
  if(error)toast(error.message);else{setting.monthly_amount=monthly_amount;render();toast("Nominal disimpan.")}
}
function moveMonth(n){month=new Date(month.getFullYear(),month.getMonth()+n,1);load()}
function todayMonth(){month=new Date();load()}

function rows(){
  const target=Number(setting.monthly_amount)||0;
  return members.map((m,i)=>{
    const p=payments.find(x=>x.member_id===m.id),amount=Number(p?.amount)||0,state=paymentState(p);
    return {
      No:i+1,Nama:m.name,
      Bulan:new Intl.DateTimeFormat("id-ID",{month:"long",year:"numeric"}).format(month),
      "Jumlah Kas":amount,
      "Target Kas":target,
      Status:paymentStatusText(state),
      "Kekurangan":state==="partial"?target-amount:0,
      "Tanggal Bayar":p?p.payment_date:""
    };
  });
}
// function excel(){
//   const income=payments.reduce((a,x)=>a+Number(x.amount||0),0),out=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
//   const wb=XLSX.utils.book_new();
//   const a=XLSX.utils.json_to_sheet(rows());
//   const b=XLSX.utils.json_to_sheet(expenses.map((x,i)=>({No:i+1,Tanggal:x.expense_date,Keterangan:x.description,Jumlah:Number(x.amount)})));
//   const c=XLSX.utils.aoa_to_sheet([
//     ["LAPORAN KAS"],["Bulan",$("monthTitle").textContent],[],["Nominal Kas / Orang",Number(setting.monthly_amount)||0],
//     ["Total Anggota",members.length],["Sudah Lunas",members.filter(m=>paymentState(payments.find(x=>x.member_id===m.id))==="paid").length],
//     ["Belum Lunas",members.filter(m=>paymentState(payments.find(x=>x.member_id===m.id))!=="paid").length],
//     ["Pemasukan",income],["Pengeluaran",out],["Saldo",income-out]
//   ]);
//   XLSX.utils.book_append_sheet(wb,a,"Status Kas");
//   XLSX.utils.book_append_sheet(wb,b,"Pengeluaran");
//   XLSX.utils.book_append_sheet(wb,c,"Ringkasan");
//   XLSX.writeFile(wb,`Laporan-Kas-${key(month)}.xlsx`);
// }
function pdf(){
  const {jsPDF}=window.jspdf,d=new jsPDF(),income=payments.reduce((a,x)=>a+Number(x.amount||0),0),out=expenses.reduce((a,x)=>a+Number(x.amount||0),0);
  d.text("Laporan Kas Bulanan",14,18);
  d.text($("monthTitle").textContent,14,25);
  d.text(`Pemasukan ${money(income)} | Pengeluaran ${money(out)} | Saldo ${money(income-out)}`,14,32);
  d.autoTable({startY:40,head:[["No","Nama","Status","Jumlah","Tanggal"]],body:rows().map(x=>[x.No,x.Nama,x.Status,money(x["Jumlah Kas"]),x["Tanggal Bayar"]?fmt(x["Tanggal Bayar"]):"-"])});
  d.autoTable({startY:d.lastAutoTable.finalY+10,head:[["No","Tanggal","Keterangan","Jumlah"]],body:expenses.map((x,i)=>[i+1,fmt(x.expense_date),x.description,money(x.amount)])});
  d.save(`Laporan-Kas-${key(month)}.pdf`);
}

let initializing=true;
async function init(){
  const {data:{session}}=await db.auth.getSession();
  initializing=false;
  if(session)await show(session.user);
}
db.auth.onAuthStateChange(async(event,session)=>{
  if(initializing)return;
  if(event==="SIGNED_IN"&&session)await show(session.user);
  if(event==="SIGNED_OUT"){
    user=null;
    $("app").classList.add("hide");
    $("auth").classList.remove("hide");
    toggleAuth(true);
  }
});
init();
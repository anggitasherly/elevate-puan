// Opportunity mapping hanya dari evidence primer yang dikembalikan Diagnosis Engine.
// Ini arah perbaikan awal, BUKAN strategi final atau hasil Gemini.
const RULES = {
 capacity_limit: [
  {field:"operational_obstacles",match:["time"],title:"Merapikan Alur Kerja Harian",description:"Kamu menyebut waktu sebagai kendala. Meninjau urutan pekerjaan harian bisa menjadi langkah awal untuk melihat bagian yang paling menyita waktu."},
  {field:"operational_obstacles",match:["stock"],title:"Menata Pemantauan Stok",description:"Karena stok menjadi kendala, kamu bisa mulai melihat kapan persediaan sering tidak mencukupi kebutuhan pesanan."},
  {field:"operational_obstacles",match:["labor"],title:"Meninjau Pembagian Tugas",description:"Keterbatasan tenaga kerja terlihat dari jawabanmu. Ada peluang untuk menata pembagian tugas agar pekerjaan lebih mudah ditangani."},
  {field:"operational_obstacles",match:["production","raw_materials"],title:"Mencermati Kesiapan Produksi",description:"Kamu menyebut kendala produksi atau bahan baku. Menelusuri tahapan yang paling sering menghambat pesanan bisa menjadi titik awal."},
  {field:"operational_obstacles",match:["shipping","packaging"],title:"Menata Proses Pemenuhan Pesanan",description:"Kendala pengiriman atau pengemasan muncul dalam jawabanmu. Alur pemenuhan pesanan bisa menjadi area yang perlu diperhatikan."},
  {field:"operational_obstacles",match:["customer_reply"],title:"Merapikan Respons Pelanggan",description:"Menjawab pesan pelanggan menjadi kendala. Kamu bisa meninjau cara mengelola pesan agar tidak menumpuk."},
  {field:"order_surge",match:["starting_overwhelmed","often_overwhelmed","very_overwhelmed"],title:"Menyiapkan Alur Saat Pesanan Meningkat",description:"Kamu mulai merasa kewalahan saat pesanan meningkat. Ada peluang untuk menata cara menerima dan memproses pesanan agar lebih terkendali."},
 ],
 low_awareness:[
  {field:"viewer_behavior",match:["many_view_few_ask"],title:"Memperjelas Informasi Produk",description:"Banyak orang melihat produkmu, tetapi belum banyak yang bertanya. Kejelasan informasi produk bisa menjadi hal yang layak ditinjau."},
 ],
 low_conversion:[
  {field:"viewer_behavior",match:["many_ask_few_buy"],title:"Memahami Hambatan Sebelum Pembelian",description:"Banyak calon pelanggan bertanya, tetapi belum membeli. Kamu bisa mencari tahu pertanyaan atau keraguan yang paling sering muncul."},
 ],
 weak_retention:[
  {field:"repeat_frequency",match:["rarely","sometimes"],title:"Memahami Alasan Pelanggan Belum Kembali",description:"Dari jawabanmu, pembelian ulang belum sering terjadi. Ada peluang untuk memahami pengalaman pelanggan setelah membeli."},
 ],
 narrow_market:[
  {field:"main_customers",match:["friends_family","mostly_close"],title:"Mengenali Calon Pelanggan di Luar Lingkaran Terdekat",description:"Pelangganmu masih banyak berasal dari lingkungan terdekat. Mengenali kelompok calon pelanggan lain bisa menjadi langkah awal."},
  {field:"market_reach",match:["mostly_close"],title:"Mengenali Calon Pelanggan di Luar Lingkaran Terdekat",description:"Pelangganmu masih banyak berasal dari lingkungan terdekat. Mengenali kelompok calon pelanggan lain bisa menjadi langkah awal."},
 ],
 inconsistent_promo:[
  {field:"promo_frequency",match:["irregular","rarely","never"],title:"Membuat Ritme Promosi yang Lebih Teratur",description:"Promosi belum dilakukan secara konsisten. Kamu bisa mulai dengan meninjau jadwal yang realistis untuk usahamu."},
 ],
 product_stagnation:[
  {field:"product_feedback",match:["yes"],title:"Meninjau Masukan Pelanggan tentang Produk",description:"Jawabanmu menunjukkan adanya masukan pelanggan. Masukan tersebut bisa menjadi bahan untuk melihat bagian produk yang perlu dikembangkan."},
 ],
 weak_finance_habits:[
  {field:"financial_recording_habit",match:["never","rarely","irregular"],title:"Membiasakan Pencatatan Keuangan",description:"Pencatatan keuangan belum rutin dilakukan. Kamu bisa mulai meninjau arus uang masuk dan keluar secara lebih teratur."},
  {field:"money_separation",match:["mixed","not_separated","partially_separated"],title:"Memisahkan Uang Usaha dan Pribadi",description:"Jawabanmu menunjukkan uang usaha dan pribadi belum sepenuhnya terpisah. Pemisahan ini bisa menjadi area perbaikan awal."},
 ],
};
function signalValues(evidence) {
 const result=[];
 for(const item of evidence) {
  if(!item || typeof item!=="object") continue;
  const field=item.source_field, value=item.value;
  if(field==="order_surge+operational_obstacles" && value && typeof value==="object") {
   result.push({field:"order_surge",value:value.order_surge});
   result.push({field:"operational_obstacles",value:value.operational_obstacles});
  } else if(field==="main_customers+sales_sources" && value && typeof value==="object") {
   result.push({field:"main_customers",value:value.customers});
   result.push({field:"sales_sources",value:value.sources});
  } else result.push({field,value});
 }
 return result;
}
export function mapBusinessOpportunities(rawDiagnosis) {
 if(rawDiagnosis?.diagnosis_status!=="diagnosed") return [];
 const code=rawDiagnosis?.primary_problem?.problem_type;
 const evidence=rawDiagnosis?.primary_problem?.evidence;
 if(!code || !Array.isArray(evidence)) return [];
 const signals=signalValues(evidence);
 const found=[];
 for(const rule of RULES[code]??[]) {
  const supported=signals.some(s=>s.field===rule.field &&
   (Array.isArray(s.value)?s.value.some(v=>rule.match.includes(v)):rule.match.includes(s.value)));
  if(supported && !found.some(f=>f.title===rule.title)) found.push({title:rule.title,description:rule.description});
 }
 return found.slice(0,3);
}

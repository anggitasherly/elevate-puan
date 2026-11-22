/** ElevatePuan deterministic diagnosis v2; no AI or database access. */
export const PROBLEM_TYPES = [
  'low_awareness','low_conversion','weak_retention','capacity_limit',
  'narrow_market','inconsistent_promo','product_stagnation','weak_finance_habits'
];
const QUESTIONS = {
  low_awareness: {field:'viewer_behavior',question:'Setelah melihat produk, apakah calon pelanggan lebih sering hanya melihat, bertanya, atau langsung membeli?',options:['many_view_few_ask','many_ask_few_buy','buy_directly']},
  low_conversion: {field:'viewer_behavior',question:'Apakah banyak calon pelanggan bertanya tetapi hanya sedikit yang akhirnya membeli?',options:['many_ask_few_buy','ask_then_some_buy','buy_directly']},
  weak_retention: {field:'repeat_frequency',question:'Seberapa sering pelanggan yang sudah membeli kembali membeli produkmu?',options:['rarely','sometimes','often','almost_always','no_data']},
  capacity_limit: {field:'order_surge',question:'Ketika pesanan meningkat, apakah operasionalmu menjadi kewalahan?',options:['easy','starting_overwhelmed','often_overwhelmed','very_overwhelmed','never_surged']},
  narrow_market: {field:'market_reach',question:'Apakah sebagian besar pembeli hanya berasal dari lingkungan atau lingkaran terdekat?',options:['mostly_close','mixed','broad','not_sure']},
  inconsistent_promo: {field:'promo_frequency',question:'Dalam satu bulan terakhir, seberapa konsisten kamu melakukan promosi?',options:['regular','irregular','none']},
  product_stagnation: {field:'product_feedback',question:'Apakah ada umpan balik pelanggan yang menunjukkan produk perlu diperbarui?',options:['yes','no','not_sure']},
  weak_finance_habits: {field:'financial_recording_habit',question:'Seberapa rutin kamu mencatat pemasukan dan pengeluaran usaha?',options:['daily','weekly','monthly','sometimes','never']}
};
const CHALLENGE_PREF = {
 hard_new_customers:['low_awareness','narrow_market'],view_not_buy:['low_conversion','low_awareness'],
 customers_not_return:['weak_retention'],inconsistent_promo:['inconsistent_promo'],
 operations_finance_overwhelmed:['capacity_limit','weak_finance_habits']
};
const valid = v => v !== undefined && v !== null && v !== '' && v !== 'no_data';
const arr = v => Array.isArray(v) ? v : [];
const sig = (field,value,role) => ({source_field:field,value,role});
export function diagnoseBusiness(assessment = {}) {
 const a = assessment && typeof assessment === 'object' && !Array.isArray(assessment) ? assessment : {};
 const evidence = Object.fromEntries(PROBLEM_TYPES.map(k=>[k,{strong:[],support:[],hint:[]}]));
 const add=(type,field,value,kind='strong')=>evidence[type][kind].push(sig(field,value,kind));
 const viewer=a.viewer_behavior;
 if(viewer==='many_view_few_ask') add('low_awareness','viewer_behavior',viewer);
 if(viewer==='many_ask_few_buy') add('low_conversion','viewer_behavior',viewer);
 if(a.repeat_frequency==='rarely') add('weak_retention','repeat_frequency',a.repeat_frequency);
 else if(a.repeat_frequency==='sometimes') add('weak_retention','repeat_frequency',a.repeat_frequency,'hint');
 if(['often_overwhelmed','very_overwhelmed'].includes(a.order_surge)) add('capacity_limit','order_surge',a.order_surge);
 else if(a.order_surge==='starting_overwhelmed') add('capacity_limit','order_surge',a.order_surge,'hint');
 const obs=arr(a.operational_obstacles).filter(x=>['time','labor','raw_materials','stock','production','shipping','packaging','customer_reply'].includes(x));
 if(obs.length) add('capacity_limit','operational_obstacles',obs,'support');
 // Independent operational obstacle corroborates an early overload signal.
 if(a.order_surge==='starting_overwhelmed' && obs.length) add('capacity_limit','order_surge+operational_obstacles',{order_surge:a.order_surge,operational_obstacles:obs},'strong');
 const customers=arr(a.main_customers), sources=arr(a.sales_sources).filter(x=>x!=='no_data');
 if(customers.includes('friends_family') && customers.length<=2) add('narrow_market','main_customers',customers,'hint');
 if(sources.length===1 && ['whatsapp','instagram'].includes(sources[0])) add('narrow_market','sales_sources',sources,'hint');
 // Narrow market is a candidate only if both independent observations are present.
 if(evidence.narrow_market.hint.length===2){
   evidence.narrow_market.strong.push(sig('main_customers+sales_sources',{customers,sources},'strong'));
   evidence.narrow_market.hint=[];
 }
 if(['never','sometimes'].includes(a.financial_recording_habit)) add('weak_finance_habits','financial_recording_habit',a.financial_recording_habit,a.financial_recording_habit==='never'?'strong':'hint');
 if(['mixed','not_separated','partially_separated'].includes(a.money_separation)) add('weak_finance_habits','money_separation',a.money_separation,['mixed','not_separated'].includes(a.money_separation)?'strong':'hint');
 if(a.market_reach==='mostly_close') add('narrow_market','market_reach',a.market_reach);
 if(a.promo_frequency==='irregular' || a.promo_frequency==='none') add('inconsistent_promo','promo_frequency',a.promo_frequency);
 if(a.product_feedback==='yes') add('product_stagnation','product_feedback',a.product_feedback);
 // User perception is a hint, never sufficient evidence on its own.
 for(const [challenge,types] of Object.entries(CHALLENGE_PREF)) if(a.biggest_challenge===challenge) for(const type of types) add(type,'biggest_challenge',challenge,'hint');
 if(a.biggest_challenge==='stagnant_sales') add('product_stagnation','biggest_challenge',a.biggest_challenge,'hint');
 if(a.biggest_challenge==='unsure_promo_strategy') add('inconsistent_promo','biggest_challenge',a.biggest_challenge,'hint');
 const ranked=PROBLEM_TYPES.map(type=>{
  const e=evidence[type];const score=e.strong.length*3+e.support.length+e.hint.length;
  return {problem_type:type,score,e,qualified:e.strong.length>0};
 }).filter(c=>c.score>0).sort((x,y)=>y.score-x.score||PROBLEM_TYPES.indexOf(x.problem_type)-PROBLEM_TYPES.indexOf(y.problem_type));
 const qualified=ranked.filter(c=>c.qualified);
 const missing_information=['viewer_behavior','repeat_frequency','order_surge','main_customers','sales_sources','financial_recording_habit','money_separation','biggest_challenge'].filter(k=>!valid(a[k]) || (Array.isArray(a[k]) && !a[k].length));
 const rounds=Math.min(2,Math.max(0,Number.isInteger(a.clarification_round)?a.clarification_round:0));
 const maxRounds=2;
 const makeQuestion=()=>{
  const preferred=CHALLENGE_PREF[a.biggest_challenge]||[];
  const hintTypes=ranked.filter(c=>!c.qualified).map(c=>c.problem_type);
  const choices=[...preferred.filter(t=>hintTypes.includes(t)),...hintTypes,'inconsistent_promo','product_stagnation','narrow_market'];
  for(const type of [...new Set(choices)]) {
   const q=QUESTIONS[type];
   if(q && !valid(a[q.field])) return {...q,problem_type:type};
  }
  return null;
 };
 const unresolved=(status,q)=>({diagnosis_status:status,primary_problem:null,contributing_problems:[],other_detected_problems:[],supporting_signals:ranked.flatMap(c=>c.e.hint),confidence:status==='undetermined'?'none':'low',missing_information,conflicting_signals:[],required_information:q?[q.field]:[],needs_clarification:status==='needs_clarification',clarification_question:q?.question??null,clarification_options:q?.options??[],clarification_field:q?.field??null,candidate_problems:ranked.map(c=>c.problem_type),clarification_round:rounds});
 if(!qualified.length){const q=rounds<maxRounds?makeQuestion():null;return unresolved(q?'needs_clarification':'undetermined',q);}
 // Tie-break only among equally supported candidates, using biggest_challenge.
 const top=qualified[0].score;
 const tied=qualified.filter(c=>c.score===top);
 const preferred=CHALLENGE_PREF[a.biggest_challenge]||[];
 const chosen=tied.find(c=>preferred.includes(c.problem_type))||qualified[0];
 const rest=qualified.filter(c=>c!==chosen);
 const confidence=chosen.e.strong.length>=2?'high':'medium';
 return {
  diagnosis_status:'diagnosed',primary_problem:{problem_type:chosen.problem_type,confidence,reason:'Didukung indikator Assessment terstruktur.',evidence:[...chosen.e.strong,...chosen.e.support]},
  contributing_problems:rest.slice(0,2).map(c=>({problem_type:c.problem_type,reason:'Didukung indikator Assessment lain.'})),
  other_detected_problems:rest.slice(2).map(c=>({problem_type:c.problem_type,reason:'Terdeteksi tetapi tidak masuk dua masalah pendukung.'})),
  supporting_signals:ranked.flatMap(c=>[...c.e.hint,...(c.qualified?[]:c.e.support)]),
  confidence,missing_information,conflicting_signals:[],required_information:[],needs_clarification:false,clarification_question:null,clarification_options:[],clarification_field:null,candidate_problems:ranked.map(c=>c.problem_type),clarification_round:rounds
 };
}

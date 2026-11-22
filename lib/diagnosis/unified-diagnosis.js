import { diagnoseBusiness } from '../diagnosis-engine.js';
import { explainDiagnosis } from '../diagnosis-explanation.js';
import { mapBusinessOpportunities } from '../business-opportunity-mapper.js';
import { diagnoseHandoverNextGrowth } from '../next-growth/handover-diagnosis-engine.js';
import { toUnifiedDiagnosis } from './shared/diagnosis-output.js';
export function runInitialDiagnosis(assessment){
 const raw=diagnoseBusiness(assessment);
 return {...toUnifiedDiagnosis('initial',{...raw,opportunities:mapBusinessOpportunities(raw)}),explanation:explainDiagnosis(raw)};
}
export function runNextGrowthDiagnosis(data) {
 const raw = diagnoseHandoverNextGrowth(data);
 return toUnifiedDiagnosis("next_growth", raw);
}
export function runDiagnosis({mode,data}){
 if(mode==='initial')return runInitialDiagnosis(data);
 if(mode==='next_growth')return runNextGrowthDiagnosis(data);
 throw new Error('Mode diagnosis tidak dikenal');
}

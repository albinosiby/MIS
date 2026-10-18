/** Exercises only newly created synthetic jobs; never changes school memberships or credentials. */
import nextEnv from "@next/env";
import {createClient} from "@supabase/supabase-js";
import {writeFile} from "node:fs/promises";
import {getSupabaseConfig} from "../src/lib/supabase/config.ts";
import {durableJobSchema} from "../src/features/jobs/schemas/job.schema.ts";
import {processDurableJob} from "../src/features/jobs/server/processor.ts";
nextEnv.loadEnvConfig(process.cwd());
const config=getSupabaseConfig(),key=process.env.SUPABASE_SERVER_SECRET_KEY;
if(!key||process.env.MIS_TEST_ACCOUNTS_ENABLED!=="true"||config.url!=="https://fxtlcapsytqyzsgcbcvp.supabase.co")throw new Error("Expected synthetic test project.");
const client=createClient(config.url,key,{global:{fetch:(input,init)=>fetch(input,{...init,signal:AbortSignal.timeout(30000)})},auth:{persistSession:false,autoRefreshToken:false}});
const checks:{case:string;passed:boolean}[]=[],owned=new Set<string>();
function check(label:string,value:unknown):asserts value{checks.push({case:label,passed:Boolean(value)});if(!value)throw new Error(label);}
async function claim(limit=10){const {data,error}=await client.rpc("mis_claim_jobs",{p_limit:limit});check("Claim RPC succeeds",!error);return durableJobSchema.array().parse(data);}
async function findOwned(id:string){for(let i=0;i<20;i++){const jobs=await claim();for(const job of jobs){if(job.id===id)return job;if(!owned.has(job.id))await processDurableJob(client,job);}}throw new Error("Synthetic job could not be claimed.");}
try{
 const {data:people,error}=await client.from("mis_memberships").select("user_id,role").eq("school_id","school-greenfield").in("role",["admin","staff"]).eq("active",true);check("Existing admin/staff memberships available",!error&&people?.length===2);
 const admin=people.find(p=>p.role==="admin")!.user_id,staff=people.find(p=>p.role==="staff")!.user_id;
 const jobs=[crypto.randomUUID(),crypto.randomUUID()];jobs.forEach(id=>owned.add(id));
 const {error:insertError}=await client.from("mis_jobs").insert(jobs.map(id=>({id,school_id:"school-greenfield",kind:"report-export",payload:{yearId:"ay-2026-27",scheduleId:`lease-${id}`,date:new Date().toISOString().slice(0,10)},dedupe_key:`lease-check:${id}`,created_by:admin,max_attempts:3,run_at:new Date().toISOString()})));check("Create two isolated synthetic jobs",!insertError);
 const [first,second]=await Promise.all([claim(1),claim(1)]),both=[...first,...second];check("Concurrent claims never share a lease/job",new Set(both.map(j=>j.id)).size===both.length);
 const claimed=new Map(both.filter(j=>owned.has(j.id)).map(j=>[j.id,j]));for(const job of both.filter(j=>!owned.has(j.id)))await processDurableJob(client,job);
 for(const id of jobs)if(!claimed.has(id))claimed.set(id,await findOwned(id));
 const a=claimed.get(jobs[0])!,b=claimed.get(jobs[1])!;
 const {error:wrongLease}=await client.rpc("mis_finish_job",{p_id:a.id,p_lease:crypto.randomUUID(),p_outcome:"completed",p_detail:"Incorrect lease test"});check("Wrong lease token is rejected",wrongLease?.code==="PT409");
 const {error:expireError}=await client.from("mis_jobs").update({lease_until:new Date(Date.now()-1000).toISOString()}).eq("id",a.id).eq("lease_token",a.lease_token);check("Expire only the synthetic lease",!expireError);
 const {error:expired}=await client.rpc("mis_finish_job",{p_id:a.id,p_lease:a.lease_token,p_outcome:"completed",p_detail:"Expired lease test"});check("Expired lease cannot finish",expired?.code==="PT409");
 const recovered=await findOwned(a.id);check("Expired lease is reclaimed with a fresh token",recovered.attempts===2&&recovered.lease_token!==a.lease_token);
 const {data:expiryAudit}=await client.from("mis_job_attempts").select("outcome,detail").eq("job_id",a.id);check("Lease expiry leaves an audit attempt",expiryAudit?.some(r=>r.detail==="Worker lease expired"&&r.outcome==="retry"));
 const {error:retryError}=await client.rpc("mis_finish_job",{p_id:a.id,p_lease:recovered.lease_token,p_outcome:"retry",p_detail:"Synthetic transient failure"});check("Transient failure schedules retry",!retryError);
 const {data:retry}=await client.from("mis_jobs").select("status,run_at").eq("id",a.id).single();check("Retry has bounded exponential backoff",retry?.status==="retry"&&Date.parse(retry.run_at)>Date.now()+20000);
 await client.from("mis_jobs").update({run_at:new Date().toISOString()}).eq("id",a.id).eq("status","retry");const finalAttempt=await findOwned(a.id);
 const {error:failure}=await client.rpc("mis_finish_job",{p_id:a.id,p_lease:finalAttempt.lease_token,p_outcome:"retry",p_detail:"Synthetic retry exhaustion"});check("Final retry finishes safely",!failure);
 const {data:failed}=await client.from("mis_jobs").select("status,attempts").eq("id",a.id).single();check("Maximum retries reach failed state",failed?.status==="failed"&&failed.attempts===3);
 const {error:staffControl}=await client.rpc("mis_control_job",{p_actor:staff,p_school:"school-greenfield",p_id:a.id,p_action:"retry"});check("Staff cannot control administrator jobs",staffControl?.code==="PT403");
 const {error:foreign}=await client.rpc("mis_control_job",{p_actor:admin,p_school:"foreign-school",p_id:a.id,p_action:"retry"});check("Foreign school control is rejected",foreign?.code==="PT403");
 const {error:adminControl}=await client.rpc("mis_control_job",{p_actor:admin,p_school:"school-greenfield",p_id:a.id,p_action:"retry"});check("Admin can restart an exhausted job",!adminControl);
 const restarted=await findOwned(a.id);check("Manual retry uses a new lease cycle",restarted.attempts===1&&restarted.lease_token!==a.lease_token);
 await client.rpc("mis_finish_job",{p_id:a.id,p_lease:restarted.lease_token,p_outcome:"cancelled",p_detail:"Synthetic verification completed"});
 await client.rpc("mis_finish_job",{p_id:b.id,p_lease:b.lease_token,p_outcome:"cancelled",p_detail:"Synthetic verification completed"});
 const {data:attempts}=await client.from("mis_job_attempts").select("id").eq("job_id",a.id);check("Manual retry preserves previous attempts",attempts?.length===4);
 const {error:cancelledRetry}=await client.rpc("mis_control_job",{p_actor:admin,p_school:"school-greenfield",p_id:a.id,p_action:"retry"});check("Cancelled work cannot be silently restarted",Boolean(cancelledRetry));
 const anonymous=createClient(config.url,config.publishableKey,{auth:{persistSession:false}});const {error:direct}=await anonymous.rpc("mis_control_job",{p_actor:admin,p_school:"school-greenfield",p_id:a.id,p_action:"retry"});check("Anonymous caller cannot invoke job controls",Boolean(direct));
}finally{
 if(owned.size)await client.from("mis_jobs").update({status:"cancelled",lease_token:null,lease_until:null}).in("id",[...owned]).in("status",["pending","running","retry","blocked"]);
 await writeFile("docs/job-lease-live-verification.json",JSON.stringify({checkedAt:new Date().toISOString(),passed:checks.filter(c=>c.passed).length,total:checks.length,checks},null,2));console.log(JSON.stringify({passed:checks.filter(c=>c.passed).length,total:checks.length}));
}

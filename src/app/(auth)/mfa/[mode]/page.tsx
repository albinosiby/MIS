import {notFound,redirect} from "next/navigation";
import {currentCloudIdentity} from "@/features/cloud/server/identity";
import {MfaScreen} from "@/features/identity/components/mfa-screen";
import "@/features/identity/styles.css";
export default async function Page({params}:{params:Promise<{mode:string}>}){const {mode}=await params;if(mode!=="enroll"&&mode!=="challenge")notFound();if(process.env.MIS_BACKEND!=="supabase")redirect("/account/security");const actor=await currentCloudIdentity({allowMfaChallenge:true,allowPasswordChange:true});if(!actor)redirect("/login");return <MfaScreen actor={actor} mode={mode}/>;}

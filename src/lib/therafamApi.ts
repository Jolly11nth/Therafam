import { apiBase, supabase } from './supabase';

export type Program = {
  id: string; title: string; description: string; category: string; difficulty_level: string;
  estimated_duration_days: number | null; thumbnail_url?: string | null; tags?: string[] | null; total_lessons?: number;
};
export type MoodEntry = { id?: string; user_id: string; mood_value: number; mood_label: string; energy_level?: number | null; anxiety_level?: number | null; stress_level?: number | null; sleep_hours?: number | null; sleep_quality?: number | null; notes?: string | null; entry_date: string; };
export type AppSettings = { id?: string; user_id: string; email_notifications: boolean; push_notifications: boolean; sms_notifications: boolean; appointment_reminders: boolean; ai_chat_notifications: boolean; profile_visibility: 'public'|'therapists_only'|'private'; data_sharing: boolean; analytics_opt_in: boolean; theme: 'light'|'dark'|'auto'; language: string; auto_save_chat: boolean; };
export type UserProfile = { id?: string; user_id: string; first_name: string; last_name: string; phone_number: string; profile_picture_url: string; bio: string; timezone: string; language_preference: string; };
export type ChatMessage = { id?: string; role: 'user'|'assistant'; content: string; created_at?: string };
export type TherapistProfile = { first_name:string; last_name:string; license_number:string; license_state:string; specializations:string; years_experience:string; bio:string; phone_number:string; timezone:string; languages_spoken:string; };

function headers(userId?: string, json = true) {
  const result: Record<string,string> = {};
  if (json) result['Content-Type'] = 'application/json';
  if (userId) result['X-Therafam-User-Id'] = userId;
  return result;
}
async function api<T>(path:string, init:RequestInit = {}, userId?:string):Promise<T>{
  if(!apiBase) throw new Error('VITE_API_BASE_URL is not configured');
  const response=await fetch(`${apiBase}${path}`,{...init,headers:{...headers(userId),...(init.headers||{})}});
  const data=await response.json().catch(()=>null);
  if(!response.ok) throw new Error(data?.detail||data?.error||`Request failed with ${response.status}`);
  return data as T;
}
export async function getHealth(){ if(!apiBase)return{status:'demo'}; return api<{status:string}>('/api/health',{headers:{}}); }
export async function sendAiMessage(message:string,history:ChatMessage[]=[],userId?:string){
  if(!apiBase)return{response:'I’m here with you. The AI service is currently in demo mode, but your message was received.',demo:true};
  if(!userId) throw new Error('Sign in to use the connected AI service.');
  return api<{response:string;conversation_id?:string;crisis?:boolean}>('/api/chat',{method:'POST',body:JSON.stringify({message,history})},userId);
}
export async function getPrograms(){if(!supabase)return[] as Program[];const{data,error}=await supabase.from('self_help_programs').select('id,title,description,category,difficulty_level,estimated_duration_days,thumbnail_url,tags,total_lessons').eq('is_published',true).order('created_at',{ascending:true});if(error)throw error;return(data??[])as Program[];}
export async function getLessons(programId:string){if(!supabase)return[];const{data,error}=await supabase.from('lessons').select('id,program_id,title,description,lesson_number,content_type,content_text,duration_minutes,learning_objectives,key_concepts,exercises').eq('program_id',programId).eq('is_published',true).order('lesson_number',{ascending:true});if(error)throw error;return data??[];}
export async function getMoodEntries(userId:string,limit=14){if(!supabase||!userId)return[]as MoodEntry[];const{data,error}=await supabase.from('mood_entries').select('*').eq('user_id',userId).order('entry_date',{ascending:false}).limit(limit);if(error)throw error;return(data??[])as MoodEntry[];}
export async function saveMoodEntry(entry:MoodEntry){if(!supabase)throw new Error('Supabase is not configured');const{data,error}=await supabase.from('mood_entries').upsert(entry,{onConflict:'user_id,entry_date'}).select().single();if(error)throw error;return data as MoodEntry;}
export async function getSettings(userId:string){if(!supabase||!userId)return null;const{data,error}=await supabase.from('user_settings').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;return data as AppSettings|null;}
export async function saveSettings(settings:AppSettings){if(!supabase)throw new Error('Supabase is not configured');const existing=await getSettings(settings.user_id);const query=existing?.id?supabase.from('user_settings').update(settings).eq('id',existing.id):supabase.from('user_settings').insert(settings);const{data,error}=await query.select().single();if(error)throw error;return data as AppSettings;}
export async function getUserProfile(userId:string){if(!supabase||!userId)return null;const{data,error}=await supabase.from('user_profiles').select('id,user_id,first_name,last_name,phone_number,profile_picture_url,bio,timezone,language_preference').eq('user_id',userId).maybeSingle();if(error)throw error;return data as UserProfile|null;}
export async function saveUserProfile(profile:UserProfile){if(!supabase)throw new Error('Supabase is not configured');const payload={...profile,updated_at:new Date().toISOString()};const{data,error}=await supabase.from('user_profiles').upsert(payload,{onConflict:'user_id'}).select().single();if(error)throw error;return data as UserProfile;}
export async function uploadProfileImage(userId:string,file:File){if(!supabase)throw new Error('Supabase is not configured');if(!file.type.startsWith('image/'))throw new Error('Please select an image file.');if(file.size>5*1024*1024)throw new Error('Profile images must be 5 MB or smaller.');const extension=file.name.split('.').pop()?.toLowerCase()||'jpg';const path=`${userId}/avatar-${Date.now()}.${extension}`;const{error:uploadError}=await supabase.storage.from('profile-images').upload(path,file,{upsert:true,contentType:file.type,cacheControl:'3600'});if(uploadError)throw uploadError;const{data}=supabase.storage.from('profile-images').getPublicUrl(path);return data.publicUrl;}

export async function getTherapistDashboard(userId:string){return api<{profile:any;active_clients:number;upcoming_sessions:number}>('/api/therapist/dashboard',{},userId);}
export async function getTherapistProfile(userId:string){return api<{profile:any}>('/api/therapist/profile',{},userId);}
export async function saveTherapistProfile(userId:string,profile:TherapistProfile){return api<{profile:any}>('/api/therapist/profile',{method:'PUT',body:JSON.stringify({...profile,specializations:profile.specializations.split(',').map(x=>x.trim()).filter(Boolean),languages_spoken:profile.languages_spoken.split(',').map(x=>x.trim()).filter(Boolean),years_experience:profile.years_experience?Number(profile.years_experience):null})},userId);}
export async function setTherapistAvailability(userId:string,is_accepting_clients:boolean){return api<{is_accepting_clients:boolean}>('/api/therapist/availability',{method:'PUT',body:JSON.stringify({is_accepting_clients})},userId);}
export async function getTherapistClients(userId:string){return api<{clients:any[]}>('/api/therapist/clients',{},userId);}
export async function getTherapistSessions(userId:string){return api<{sessions:any[]}>('/api/therapist/sessions',{},userId);}
export async function getTherapistNotes(userId:string){return api<{notes:any[]}>('/api/therapist/notes',{},userId);}
export async function getTherapistMessages(userId:string){return api<{messages:any[]}>('/api/therapist/messages',{},userId);}
export async function submitSupport(userId:string,category:'contact'|'report',message:string){return api<{submitted:boolean}>('/api/support',{method:'POST',body:JSON.stringify({category,message})},userId);}
export type SubscriptionStatus={subscription:any;features_locked:boolean;trial_days_remaining:number|null};
export type TherapistEarnings={available_balance:number;pending_balance:number;total_earned:number;total_withdrawn:number;performance:any;transactions:any[]};

export async function getSubscription(userId:string){return api<SubscriptionStatus>('/api/subscription',{},userId);}
export async function upgradeSubscription(userId:string,plan:'premium_monthly'|'premium_annual'='premium_monthly'){return api('/api/subscription/upgrade',{method:'POST',body:JSON.stringify({plan})},userId);}
export async function getTherapistEarnings(userId:string){return api<TherapistEarnings>('/api/therapist/earnings',{},userId);}
export async function recalculateTherapistEarnings(userId:string){return api<{recalculated:boolean;new_earnings:number}>('/api/therapist/earnings/recalculate',{method:'POST'},userId);}
export async function getTherapistPerformance(userId:string){return api<{performance_history:any[]}>('/api/therapist/performance',{},userId);}

export function getStoredUserId(){return localStorage.getItem('therafam:userId')??'';}

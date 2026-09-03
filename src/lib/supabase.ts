import { getStoredUserId } from './therafamApi';

export const apiBase = import.meta.env.VITE_API_BASE_URL ?? '';
export const supabaseConfigured = false;

async function request(path:string,init:RequestInit={}){
  const token=localStorage.getItem('therafam:session');
  const headers:Record<string,string>={...(init.headers as Record<string,string>|undefined)};
  if(token) headers.Authorization=`Bearer ${token}`;
  else { const id=getStoredUserId(); if(id) headers['X-Therafam-User-Id']=id; }
  if(init.body && !(init.body instanceof FormData)) headers['Content-Type']='application/json';
  const r=await fetch(`${apiBase}${path}`,{...init,headers});
  const data=await r.json().catch(()=>null);
  if(!r.ok) return {data:null,error:{message:data?.detail||`Request failed with ${r.status}`}};
  return {data,error:null};
}

class QueryBuilder<T=any>{
  private action:'select'|'insert'|'update'|'upsert'='select'; private body:any; private filters:Record<string,string>={}; private limitValue:number|undefined; private orderValue:string|undefined; private ascending=true;
  constructor(private table:string){}
  select(_fields?:string,_opts?:any){this.action='select';return this}
  eq(key:string,value:any){this.filters[key]=String(value);return this}
  or(value:string){const m=value.match(/sender_id\.eq\.([^,]+),recipient_id\.eq\.([^,]+)/);if(m){this.filters.sender_id=m[1];this.filters.recipient_id=m[2]}return this}
  order(field:string,opts?:{ascending?:boolean}){this.orderValue=field;this.ascending=opts?.ascending??true;return this}
  limit(n:number){this.limitValue=n;return this}
  insert(body:any){this.action='insert';this.body=body;return this}
  update(body:any){this.action='update';this.body=body;return this}
  upsert(body:any,_opts?:any){this.action='upsert';this.body=body;return this}
  single(){return this.execute(true)}
  maybeSingle(){return this.execute(true)}
  then(resolve:any,reject?:any){return this.execute(false).then(resolve,reject)}
  async execute(single:boolean){
    const uid=getStoredUserId();
    if(this.table==='therapist_profiles'){
      if(this.action==='select'){
        const r=await request('/api/therapist/profile');const p=r.data?.profile;return {data:single?(p??null):[p].filter(Boolean),error:r.error,count:null};
      }
      if(this.action==='update'||this.action==='upsert'){
        const r=await request('/api/therapist/profile',{method:'PUT',body:JSON.stringify({...this.body})});return {data:single?(r.data?.profile??null):r.data?.profile?[r.data.profile]:[],error:r.error,count:null};
      }
    }
    if(this.table==='chat_messages'){
      if(this.action==='select'){
        const r=await request('/api/therapist/messages');let rows=r.data?.messages??[];if(this.filters.sender_id&&this.filters.recipient_id)rows=rows.filter((x:any)=>x.sender_id===this.filters.sender_id||x.recipient_id===this.filters.recipient_id);if(this.orderValue)rows.sort((a:any,b:any)=>new Date(a[this.orderValue!]).getTime()-new Date(b[this.orderValue!]).getTime());if(this.limitValue)rows=rows.slice(0,this.limitValue);return {data:single?(rows[0]??null):rows,error:r.error,count:rows.length};
      }
      if(this.action==='insert'){
        const r=await request('/api/messages',{method:'POST',body:JSON.stringify({recipient_id:this.body.recipient_id??this.filters.recipient_id,message_text:this.body.message_text,session_id:this.body.session_id})});return {data:single?(r.data?.message??null):[r.data?.message].filter(Boolean),error:r.error,count:null};
      }
    }
    if(this.table==='therapist_client_relationships' || this.table==='therapy_sessions'){
      const endpoint=this.table==='therapist_client_relationships'?'/api/therapist/dashboard':'/api/therapist/sessions';
      const r=await request(endpoint);let rows=this.table==='therapist_client_relationships'?[...(r.data?.clients??[])]:[...(r.data?.sessions??[])];
      if(single) return {data:rows[0]??null,error:r.error,count:rows.length};
      return {data:rows,error:r.error,count:rows.length};
    }
    return {data:single?null:[],error:{message:`Legacy Supabase adapter does not support ${this.table}`},count:0};
  }
}

export const supabase={
  from:(table:string)=>new QueryBuilder(table),
  auth:{signOut:async()=>{localStorage.removeItem('therafam:session');localStorage.removeItem('therafam:userId');return {error:null}}},
};

export async function callBackend(path:string,init:RequestInit={}){const r=await request(path,init);if(r.error)throw new Error(r.error.message);return new Response(JSON.stringify(r.data),{status:200,headers:{'Content-Type':'application/json'}})}

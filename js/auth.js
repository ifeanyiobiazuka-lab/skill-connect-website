const API = "/api";
const tokenKey = "jobSkillToken";

function getToken(){ return localStorage.getItem(tokenKey); }
function saveSession(data){ localStorage.setItem(tokenKey,data.token); localStorage.setItem("jobSkillUser",JSON.stringify(data.user)); }
function clearSession(){ localStorage.removeItem(tokenKey); localStorage.removeItem("jobSkillUser"); }
function showNotice(message,type="error"){
  const el=document.getElementById("notice"); if(!el)return;
  el.textContent=message; el.className=`notice ${type}`;
}
async function api(path, options={}){
  const headers={"Content-Type":"application/json",...(options.headers||{})};
  const token=getToken(); if(token) headers.Authorization=`Bearer ${token}`;
  const res=await fetch(API+path,{...options,headers});
  const data=await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.error||"Something went wrong.");
  return data;
}

const loginForm=document.getElementById("loginForm");
if(loginForm) loginForm.addEventListener("submit",async e=>{
  e.preventDefault();
  try{
    const data=await api("/auth/login",{method:"POST",body:JSON.stringify({
      email:document.getElementById("email").value,password:document.getElementById("password").value
    })});
    saveSession(data);
    window.location.href=data.user.role==="admin" ? "/admin/dashboard.html" : "/user/dashboard.html";
  }catch(err){showNotice(err.message);}
});

const signupForm=document.getElementById("signupForm");
if(signupForm) signupForm.addEventListener("submit",async e=>{
  e.preventDefault();
  const password=document.getElementById("password").value;
  if(password!==document.getElementById("confirmPassword").value) return showNotice("Passwords do not match.");
  try{
    const data=await api("/auth/register",{method:"POST",body:JSON.stringify({
      firstName:document.getElementById("firstName").value,lastName:document.getElementById("lastName").value,
      email:document.getElementById("email").value,phone:document.getElementById("phone").value,
      accountType:document.getElementById("accountType").value,password
    })});
    saveSession(data); showNotice("Account created. Redirecting...","success");
    setTimeout(()=>location.href="/user/dashboard.html",500);
  }catch(err){showNotice(err.message);}
});
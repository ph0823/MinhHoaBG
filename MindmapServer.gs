/**
 * Mindmap Learning Studio V3.0 – dedicated Google Apps Script Web App.
 * Script properties: MINDMAP_TEACHER_PASSWORD (exactly 8 digits, stored as text),
 * MINDMAP_SPREADSHEET_ID, MINDMAP_FOLDER_ID (private Drive folder).
 * Do not reuse the script of other teaching apps.
 */
function doGet() { return output_({ok:true,service:"Mindmap V3.1"}); }
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function fail_(message){throw new Error(message);}
function props_(){return PropertiesService.getScriptProperties();}
function sheet_(name,headers){
  var id=props_().getProperty("MINDMAP_SPREADSHEET_ID");
  if(!id)fail_("Máy chủ chưa được cấu hình.");
  var ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName(name);
  if(!sh){sh=ss.insertSheet(name);sh.appendRow(headers);sh.setFrozenRows(1);}
  return sh;
}
function assignments_(){return sheet_("Mindmap_NhiemVu",["id","title","instructions","minBranches","minImages","minLinks","createdAt"]);}
function submissions_(){return sheet_("Mindmap_BaiNop",["receipt","requestId","secretHash","assignment","name","cls","stt","fileId","createdAt","status","score","comment","reviewedAt"]);}
function rows_(sh){var n=sh.getLastRow();return n<2?[]:sh.getRange(2,1,n-1,sh.getLastColumn()).getValues();}
function digest_(v){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v))).replace(/=+$/,"");}
function teacher_(p,token){
  if(typeof token==="string"&&/^[a-f0-9]{64}$/.test(token)&&CacheService.getScriptCache().get("mm_session_"+digest_(token))==="1")return;
  var expected=props_().getProperty("MINDMAP_TEACHER_PASSWORD");
  if(!expected||!/^\d{8}$/.test(expected))fail_("Chưa thiết lập mã giáo viên gồm đúng 8 chữ số.");
  if(typeof p!=="string"||!/^\d{8}$/.test(p)||digest_(p)!==digest_(expected))fail_("Mật khẩu không đúng.");
}
function class_(v){var c=str_(v,30,true).toUpperCase();if(!/^9A[1-9]$/.test(c))fail_("Lớp không hợp lệ.");return c;}
function str_(v,max,required){if(typeof v!=="string"||v.length>max||required&&!v.trim())fail_("Thông tin không hợp lệ.");return v.trim();}
function integer_(v,min,max){if(typeof v!=="number"||!isFinite(v)||Math.floor(v)!==v||v<min||v>max)fail_("Giá trị số không hợp lệ.");return v;}
function safeCell_(v){v=String(v);return /^[=+\-@\t\r]/.test(v)?"'"+v:v;}
function id_(){return Utilities.getUuid().replace(/-/g,"");}
function assignmentView_(r){return {id:String(r[0]),title:String(r[1]),instructions:String(r[2]),minBranches:Number(r[3]),minImages:Number(r[4]),minLinks:Number(r[5])};}
function submissionView_(r){return {receipt:String(r[0]),assignment:String(r[3]),name:String(r[4]),cls:String(r[5]),stt:Number(r[6]),createdAt:String(r[8]),status:String(r[9]),score:r[10]===""?"":Number(r[10]),comment:String(r[11]),reviewedAt:String(r[12])};}
function find_(rows,index,value){for(var i=0;i<rows.length;i++)if(String(rows[i][index])===String(value))return {row:rows[i],number:i+2};return null;}
function validateProject_(p){
  if(!p||[1,2,3].indexOf(p.version)<0||!Array.isArray(p.nodes)||p.nodes.length<1||p.nodes.length>500)fail_("Sơ đồ không hợp lệ.");
  var ids=Object.create(null);
  p.nodes.forEach(function(n){
    if(!n||typeof n.id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(n.id)||ids[n.id]||typeof n.text!=="string"||n.text.length>20000||typeof n.x!=="number"||typeof n.y!=="number"||!isFinite(n.x)||!isFinite(n.y)||Math.abs(n.x)>1000000||Math.abs(n.y)>1000000)fail_("Dữ liệu nhánh không hợp lệ.");
    if(n.parentId!=null&&typeof n.parentId!=="string")fail_("Nhánh cha không hợp lệ.");
    if(n.note!=null&&(typeof n.note!=="string"||n.note.length>4000))fail_("Ghi chú không hợp lệ.");
    var image=n.image||"",link=n.link||"";
    if(typeof image!=="string"||typeof link!=="string"||image&&!/^https?:\/\/|^data:image\/(png|jpeg|jpg|gif|webp|bmp|x-icon);base64,[A-Za-z0-9+/=]+$/i.test(image)||link&&!/^https?:\/\/|^data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(link)||/^data:(text\/html|image\/svg\+xml|application\/xhtml\+xml|application\/(javascript|x-msdownload|x-executable|x-sh|x-bat)|text\/javascript);/i.test(link))fail_("Hình ảnh hoặc liên kết không hợp lệ.");
    ids[n.id]=n;
  });
  p.nodes.forEach(function(n){
    var seen=Object.create(null),x=n;while(x){if(seen[x.id])fail_("Sơ đồ có vòng lặp.");seen[x.id]=true;if(x.parentId&&!ids[x.parentId])fail_("Thiếu nhánh cha.");x=x.parentId?ids[x.parentId]:null;}
    if(n.cross!=null&&(!Array.isArray(n.cross)||n.cross.length>100||n.cross.some(function(id){return typeof id!=="string"||id===n.id||!ids[id];})))fail_("Liên kết chéo không hợp lệ.");
  });
  var raw=JSON.stringify(p);if(raw.length>4*1024*1024)fail_("Bài vượt quá giới hạn 4 MB dữ liệu JSON.");return raw;
}
function doPost(e){
  var lock=null;
  try{
    var raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>5*1024*1024)fail_("Yêu cầu quá lớn hoặc không hợp lệ.");
    var p=JSON.parse(raw),a=p.action;
    if(a==="teacherLogin"){teacher_(p.password);var token=id_()+id_();CacheService.getScriptCache().put("mm_session_"+digest_(token),"1",1200);return output_({ok:true,token:token,expiresIn:1200});}
    if(a==="teacherLogout"){if(typeof p.token==="string")CacheService.getScriptCache().remove("mm_session_"+digest_(p.token));return output_({ok:true});}
    if(["teacherList","createAssignment","teacherGet","review","teacherEdit","teacherDelete"].indexOf(a)>=0)teacher_(p.password,p.token);
    // Serialize sheet initialization, submission and assessment. No public listing of students.
    lock=LockService.getScriptLock();if(!lock.tryLock(15000))fail_("Hệ thống đang bận. Hãy thử lại.");
    var ash=assignments_(), ar=rows_(ash), sh=submissions_(), sr=rows_(sh);
    if(!find_(ar,0,"TIN9_B7")){var defaultRow=["TIN9_B7","Tin học 9 – Bài 7: Sơ đồ tư duy","Tạo sơ đồ tư duy theo yêu cầu của giáo viên.",0,0,0,new Date()];ash.appendRow(defaultRow);ar.push(defaultRow);}
    if(a==="assignment"){
      var found=find_(ar,0,str_(p.id,64,true));if(!found)fail_("Không tìm thấy nhiệm vụ.");return output_({ok:true,assignment:assignmentView_(found.row)});
    }
    if(a==="createAssignment"){
      var row=["MM-"+id_().slice(0,12),str_(p.title,150,true),str_(p.instructions,4000,true),integer_(p.minBranches,0,500),integer_(p.minImages,0,500),integer_(p.minLinks,0,500),new Date()];
      ash.appendRow(row.map(function(v,i){return i===1||i===2?safeCell_(v):v;}));return output_({ok:true,assignment:assignmentView_(row)});
    }
    if(a==="submit"){
      var aid=str_(p.id,64,true),name=str_(p.name,100,true),cls=class_(p.cls),stt=integer_(p.stt,1,50),req=str_(p.requestId,120,true),secret=str_(p.clientSecret,128,true);
      if(!/^[a-zA-Z0-9_-]{16,120}$/.test(req)||! /^[a-zA-Z0-9_-]{24,128}$/.test(secret))fail_("Mã bài không hợp lệ.");
      if(!find_(ar,0,aid))fail_("Không tìm thấy nhiệm vụ.");
      var existing=find_(sr,1,req);
      if(existing){if(existing.row[2]!==digest_(secret)||existing.row[3]!==aid)fail_("Mã bài không khớp.");return output_({ok:true,receipt:existing.row[0],secret:secret});}
      p.project.student={name:name,cls:cls,stt:String(stt)};
      var project=validateProject_(p.project),folderId=props_().getProperty("MINDMAP_FOLDER_ID");
      if(!folderId)fail_("Chưa cấu hình thư mục lưu bài.");
      var receipt="MMB-"+id_(),file=DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(project,"application/json",receipt+".json"));
      try{sh.appendRow([receipt,req,digest_(secret),aid,safeCell_(name),safeCell_(cls),stt,file.getId(),new Date(),"Đã nhận","","",""]);}catch(err){try{file.setTrashed(true);}catch(ignore){}throw err;}
      return output_({ok:true,receipt:receipt,secret:secret});
    }
    if(a==="status"){
      var found=find_(sr,1,str_(p.requestId,120,true));if(!found)return output_({ok:true,saved:false});
      if(found.row[2]!==digest_(str_(p.clientSecret,128,true)))fail_("Mã bài không khớp.");return output_({ok:true,saved:true,receipt:String(found.row[0]),secret:p.clientSecret});
    }
    if(a==="feedback"){
      var f=find_(sr,0,str_(p.receipt,80,true));
      if(!f||f.row[9]==="Đã xóa"||f.row[2]!==digest_(str_(p.secret,128,true)))fail_("Mã bài hoặc mã truy cập không đúng.");
      return output_({ok:true,feedback:{status:f.row[9],score:f.row[10],comment:f.row[11]}});
    }
    if(a==="teacherList")return output_({ok:true,assignments:ar.map(assignmentView_),submissions:sr.filter(function(r){return r[9]!=="Đã xóa";}).map(submissionView_).reverse()});
    if(a==="teacherEdit"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var name=str_(p.name,100,true),cls=class_(p.cls),stt=integer_(p.stt,1,50);sh.getRange(f.number,5,1,3).setValues([[safeCell_(name),cls,stt]]);return output_({ok:true});
    }
    if(a==="teacherDelete"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f)fail_("Không tìm thấy bài.");sh.getRange(f.number,10).setValue("Đã xóa");return output_({ok:true});
    }
    if(a==="teacherGet"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var project=JSON.parse(DriveApp.getFileById(f.row[7]).getBlob().getDataAsString("UTF-8"));project.student={name:String(f.row[4]),cls:String(f.row[5]),stt:String(f.row[6])};return output_({ok:true,submission:submissionView_(f.row),project:project});
    }
    if(a==="review"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var score=p.score===""?"":Number(p.score),status=str_(p.status,60,true),comment=str_(p.comment,4000,false);
      if(score!==""&&(!isFinite(score)||score<0||score>10))fail_("Điểm phải từ 0 đến 10.");
      if(["Đã nhận","Yêu cầu chỉnh sửa","Đã đánh giá"].indexOf(status)<0)fail_("Trạng thái không hợp lệ.");
      sh.getRange(f.number,10,1,4).setValues([[status,score,safeCell_(comment),new Date()]]);
      return output_({ok:true});
    }
    fail_("Yêu cầu không được hỗ trợ.");
  }catch(err){console.error(err);return output_({ok:false,error:err.message||"Không thực hiện được."});}
  finally{if(lock&&lock.hasLock())lock.releaseLock();}
}

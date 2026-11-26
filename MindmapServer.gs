/**
 * Mindmap Learning Studio V3.0 – dedicated Google Apps Script Web App.
 * Script properties: MINDMAP_TEACHER_PASSWORD (exactly 8 digits, stored as text),
 * MINDMAP_SPREADSHEET_ID, MINDMAP_FOLDER_ID (private Drive folder).
 * Do not reuse the script of other teaching apps.
 */
function doGet() { return output_({ok:true,service:"Mindmap V3.3"}); }
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function fail_(message){throw new Error(message);}
function props_(){return PropertiesService.getScriptProperties();}
function sheet_(name,headers){
  var id=props_().getProperty("MINDMAP_SPREADSHEET_ID");
  if(!id)fail_("Máy chủ chưa được cấu hình.");
  var ss=SpreadsheetApp.openById(id),sh=ss.getSheetByName(name);
  if(!sh)sh=ss.insertSheet(name);
  if(sh.getLastRow()===0){sh.getRange(1,1,1,headers.length).setValues([headers]);sh.setFrozenRows(1);}
  else{
    var actual=sh.getRange(1,1,1,headers.length).getValues()[0];
    var oldCount=name==="Mindmap_BaiNop"?13:headers.length;
    for(var i=0;i<oldCount;i++)if(String(actual[i]).trim()!==headers[i])fail_("Cấu trúc sheet "+name+" không đúng. Kiểm tra hàng tiêu đề trước khi lưu.");
    for(var j=oldCount;j<headers.length;j++)if(actual[j]!==""&&String(actual[j]).trim()!==headers[j])fail_("Cột bổ sung của "+name+" đang chứa dữ liệu khác.");
    if(actual.slice(oldCount).some(function(x){return x==="";})){
      if(sh.getLastRow()>1&&sh.getRange(2,oldCount+1,sh.getLastRow()-1,headers.length-oldCount).getValues().some(function(row){return row.some(function(v){return v!=="";});}))fail_("Các cột bổ sung đang có dữ liệu. Không tự ghi đè.");
      sh.getRange(1,oldCount+1,1,headers.length-oldCount).setValues([headers.slice(oldCount)]);
    }
  }
  return sh;
}
function assignments_(){return sheet_("Mindmap_NhiemVu",["id","title","instructions","minBranches","minImages","minLinks","createdAt"]);}
function submissions_(){return sheet_("Mindmap_BaiNop",["receipt","requestId","secretHash","assignment","name","cls","stt","fileId","createdAt","status","score","comment","reviewedAt","studentKey","attempt","nodeCount","imageCount","linkCount","fileUrl","contentHash"]);}
function rows_(sh){var n=sh.getLastRow();return n<2?[]:sh.getRange(2,1,n-1,sh.getName()==="Mindmap_BaiNop"?20:7).getValues();}
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
function iso_(v){return v instanceof Date?v.toISOString():String(v||"");}
function studentKey_(aid,cls,stt){return aid+"|"+cls+"|"+stt;}
function submissionView_(r){return {receipt:String(r[0]),assignment:String(r[3]),name:String(r[4]),cls:String(r[5]),stt:Number(r[6]),createdAt:iso_(r[8]),status:String(r[9]),score:r[10]===""?"":Number(r[10]),comment:String(r[11]),reviewedAt:iso_(r[12]),attempt:r[14]||"",nodeCount:r[15]||"",imageCount:r[16]||"",linkCount:r[17]||""};}
function find_(rows,index,value){for(var i=0;i<rows.length;i++)if(String(rows[i][index])===String(value))return {row:rows[i],number:i+2};return null;}
function mediaUrl_(v){return typeof v==="string"&&v.length<=8192&&/^https?:\/\/[^\s\x00-\x1f/@?#]+(?::[0-9]+)?(?:[/?#][^\s\x00-\x1f]*)?$/i.test(v)&&!/^https?:\/\/[^/?#]*@/i.test(v);}
function dataMedia_(v,image){if(typeof v!=="string")return false;var m=/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(v);if(!m||m[2].length%4!==0)return false;if(image)return /^image\/(png|jpeg|jpg|gif|webp|bmp|x-icon)$/i.test(m[1]);return !/^(text\/(html|javascript)|image\/svg\+xml|application\/(xhtml\+xml|javascript|x-msdownload|x-executable|x-sh|x-bat))$/i.test(m[1]);}
function readVerified_(row){var raw=DriveApp.getFileById(String(row[7])).getBlob().getDataAsString("UTF-8");if(row[19]&&digest_(raw)!==String(row[19]))fail_("Tệp bài nộp không khớp dữ liệu đã lưu. Cần kiểm tra lại.");return raw;}
function validateProject_(p){
  if(!p||[1,2,3].indexOf(p.version)<0||!Array.isArray(p.nodes)||p.nodes.length<1||p.nodes.length>500)fail_("Sơ đồ không hợp lệ.");
  var ids=Object.create(null);
  p.nodes.forEach(function(n){
    if(!n||typeof n.id!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(n.id)||ids[n.id]||typeof n.text!=="string"||n.text.length>20000||typeof n.x!=="number"||typeof n.y!=="number"||!isFinite(n.x)||!isFinite(n.y)||Math.abs(n.x)>1000000||Math.abs(n.y)>1000000)fail_("Dữ liệu nhánh không hợp lệ.");
    if(n.parentId!=null&&typeof n.parentId!=="string")fail_("Nhánh cha không hợp lệ.");
    if(n.note!=null&&(typeof n.note!=="string"||n.note.length>4000))fail_("Ghi chú không hợp lệ.");
    var image=n.image||"",link=n.link||"";
    if(typeof image!=="string"||typeof link!=="string"||image&&!mediaUrl_(image)&&!dataMedia_(image,true)||link&&!mediaUrl_(link)&&!dataMedia_(link,false))fail_("Hình ảnh hoặc liên kết không hợp lệ.");
    if(n.linkName!=null&&(typeof n.linkName!=="string"||n.linkName.length>1024))fail_("Tên tệp đính kèm không hợp lệ.");
    ids[n.id]=n;
  });
  p.nodes.forEach(function(n){
    var seen=Object.create(null),x=n;while(x){if(seen[x.id])fail_("Sơ đồ có vòng lặp.");seen[x.id]=true;if(x.parentId&&!ids[x.parentId])fail_("Thiếu nhánh cha.");x=x.parentId?ids[x.parentId]:null;}
    if(n.cross!=null&&(!Array.isArray(n.cross)||n.cross.length>100||n.cross.some(function(id){return typeof id!=="string"||id===n.id||!ids[id];})))fail_("Liên kết chéo không hợp lệ.");
  });
  var raw=JSON.stringify(p);if(Utilities.newBlob(raw).getBytes().length>4*1024*1024)fail_("Bài vượt quá giới hạn 4 MB dữ liệu JSON.");return raw;
}
function doPost(e){
  var lock=null;
  try{
    var raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>5*1024*1024||Utilities.newBlob(raw).getBytes().length>5*1024*1024)fail_("Yêu cầu quá lớn hoặc không hợp lệ.");
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
      if(existing){if(existing.row[2]!==digest_(secret)||existing.row[3]!==aid)fail_("Mã bài không khớp.");if(existing.row[9]==="Đã xóa")fail_("Bài đã được giáo viên loại bỏ. Hãy liên hệ giáo viên.");readVerified_(existing.row);return output_({ok:true,receipt:existing.row[0],secret:secret,duplicate:true,createdAt:iso_(existing.row[8])});}
      if(!p.project||typeof p.project!=="object")fail_("Thiếu dữ liệu sơ đồ.");
      p.project.student={name:name,cls:cls,stt:String(stt)};
      var project=validateProject_(p.project),folderId=props_().getProperty("MINDMAP_FOLDER_ID");
      if(!folderId)fail_("Chưa cấu hình thư mục lưu bài.");
      var key=studentKey_(aid,cls,stt), attempt=0, count=0;
      sr.forEach(function(row){if(studentKey_(String(row[3]),String(row[5]).toUpperCase(),Number(row[6]))===key){count++;attempt=Math.max(attempt,Number(row[14])||0);}});
      attempt=Math.max(attempt,count)+1;
      var receipt="MMB-"+id_(),file=DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(project,"application/json",receipt+".json")),now=new Date();
      var entry=[receipt,req,digest_(secret),aid,safeCell_(name),cls,stt,file.getId(),now,"Đã nhận","","","",key,attempt,p.project.nodes.length,p.project.nodes.filter(function(n){return !!n.image;}).length,p.project.nodes.filter(function(n){return !!n.link;}).length,file.getUrl(),digest_(project)];
      try{
        readVerified_(entry);
        sh.appendRow(entry);SpreadsheetApp.flush();
        var committed=find_(rows_(sh),1,req);
        if(!committed||String(committed.row[0])!==receipt||String(committed.row[7])!==file.getId())fail_("Chưa xác nhận được dữ liệu bài nộp.");
      }catch(err){
        // A flush/read can fail after the row was committed. Never trash a file that might already be referenced.
        console.error("Mindmap commit uncertain",receipt,err);
        fail_("Chưa xác nhận được bài nộp. Hãy kiểm tra trạng thái hoặc gửi lại.");
      }
      return output_({ok:true,receipt:receipt,secret:secret,createdAt:now.toISOString(),attempt:attempt});
    }
    if(a==="status"){
      var found=find_(sr,1,str_(p.requestId,120,true));if(!found)return output_({ok:true,saved:false});
      if(found.row[2]!==digest_(str_(p.clientSecret,128,true)))fail_("Mã bài không khớp.");if(found.row[9]==="Đã xóa")fail_("Bài đã được giáo viên loại bỏ.");readVerified_(found.row);return output_({ok:true,saved:true,receipt:String(found.row[0]),secret:p.clientSecret,createdAt:iso_(found.row[8])});
    }
    if(a==="feedback"){
      var f=find_(sr,0,str_(p.receipt,80,true));
      if(!f||f.row[9]==="Đã xóa"||f.row[2]!==digest_(str_(p.secret,128,true)))fail_("Mã bài hoặc mã truy cập không đúng.");
      return output_({ok:true,feedback:{status:f.row[9],score:f.row[10],comment:f.row[11]}});
    }
    if(a==="teacherList")return output_({ok:true,assignments:ar.map(assignmentView_),submissions:sr.filter(function(r){return r[9]!=="Đã xóa";}).map(submissionView_).reverse()});
    if(a==="teacherEdit"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var name=str_(p.name,100,true),cls=class_(p.cls),stt=integer_(p.stt,1,50);sh.getRange(f.number,5,1,3).setValues([[safeCell_(name),cls,stt]]);sh.getRange(f.number,14).setValue(studentKey_(f.row[3],cls,stt));SpreadsheetApp.flush();return output_({ok:true});
    }
    if(a==="teacherDelete"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f)fail_("Không tìm thấy bài.");sh.getRange(f.number,10).setValue("Đã xóa");return output_({ok:true});
    }
    if(a==="teacherGet"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var project=JSON.parse(readVerified_(f.row));project.student={name:String(f.row[4]),cls:String(f.row[5]),stt:String(f.row[6])};return output_({ok:true,submission:submissionView_(f.row),project:project,integrity:f.row[19]?"verified":"legacy"});
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

/**
 * Mindmap Learning Studio V3.0 – dedicated Google Apps Script Web App.
 * Script properties: MINDMAP_TEACHER_PASSWORD (exactly 8 digits, stored as text),
 * MINDMAP_SPREADSHEET_ID, MINDMAP_FOLDER_ID (private Drive folder).
 * Do not reuse the script of other teaching apps.
 */
function doGet() { return output_({ok:true,service:"Mindmap V3.6.5"}); }
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
function stageFolder_(req,secret,create){
  var root=DriveApp.getFolderById(props_().getProperty("MINDMAP_FOLDER_ID"));
  var name="MM_assets_"+digest_(req+"|"+secret),it=root.getFoldersByName(name);
  if(it.hasNext())return it.next();if(!create)fail_("Chưa lưu đủ tài nguyên.");return root.createFolder(name);
}
function mediaHash_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,v).map(function(b){return ("0"+(b&255).toString(16)).slice(-2);}).join("");}
function assetData_(folder,hash,mime){
  if(!/^[a-f0-9]{64}$/.test(hash)||!/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/i.test(mime))fail_("Mã tài nguyên không hợp lệ.");
  var it=folder.getFilesByName(hash);if(!it.hasNext())fail_("Thiếu tài nguyên đã lưu.");
  var blob=it.next().getBlob(),data="data:"+mime+";base64,"+Utilities.base64Encode(blob.getBytes());
  if(mediaHash_(data)!==hash)fail_("Tài nguyên không khớp dữ liệu đã lưu.");return data;
}
function assetRefs_(p){var refs=[];p.nodes.forEach(function(n){["image","link"].forEach(function(k){var a=n[k+"Asset"];if(a){if(n[k]||typeof a.hash!=="string"||!/^[a-f0-9]{64}$/.test(a.hash)||typeof a.mime!=="string"||!/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/i.test(a.mime))fail_("Tham chiếu tài nguyên không hợp lệ.");refs.push({node:n,key:k,asset:a});}});});return refs;}
function verifyAssets_(p,folder){
  var seen=Object.create(null),total=0;
  assetRefs_(p).forEach(function(r){var a=r.asset;if(!seen[a.hash]){var data=assetData_(folder,a.hash,a.mime);seen[a.hash]=data;total+=data.length;if(total>16*1024*1024)fail_("Tổng tài nguyên quá lớn.");}if(!dataMedia_(seen[a.hash],r.key==="image"))fail_("Loại tài nguyên không hợp lệ.");});
}
function verifyStored_(row){var raw=readVerified_(row),p=JSON.parse(raw);if(p.assetFolder){var folder=DriveApp.getFolderById(p.assetFolder);verifyAssets_(p,folder);}return p;}
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
// Only non-identifying request/receipt digests are retained to prevent retry resurrection.
function deletedRequests_(){return sheet_("Mindmap_DeletedRequests",["requestHash","receiptHash"]);}
function deletedRequest_(req){return !!findDeleted_(deletedRequests_(),0,digest_(req));}
function findDeleted_(sh,col,value){var n=sh.getLastRow();if(n<2)return null;var cell=sh.getRange(2,col+1,n-1,1).createTextFinder(value).matchEntireCell(true).matchCase(true).findNext();return cell;}
function directChild_(item,rootId){var it=item.getParents();while(it.hasNext())if(it.next().getId()===rootId)return true;return false;}
function purgeSubmission_(sh,sr,f){
  var row=f.row,receipt=String(row[0]),rootId=props_().getProperty("MINDMAP_FOLDER_ID"),fileId=String(row[7]);
  if(!rootId||!fileId||sr.some(function(r){return r!==row&&String(r[7])===fileId;}))fail_("Không thể xác định tệp riêng của bài.");
  var file=DriveApp.getFileById(fileId);
  if(!directChild_(file,rootId)||file.getName()!==receipt+".json")fail_("Tệp không thuộc thư mục bài nộp.");
  var project=JSON.parse(readVerified_(row)),folder=null;
  if(project.assetFolder){
    if(!row[19])fail_("Không xác minh được thư mục tài nguyên.");
    folder=DriveApp.getFolderById(project.assetFolder);
    if(folder.getId()===rootId||!directChild_(folder,rootId)||!/^MM_assets_[A-Za-z0-9_-]+$/.test(folder.getName()))fail_("Thư mục tài nguyên không hợp lệ.");
    var subfolders=folder.getFolders();if(subfolders.hasNext())fail_("Thư mục tài nguyên có nội dung ngoài dự kiến.");
    var allowed=Object.create(null);assetRefs_(project).forEach(function(r){allowed[r.asset.hash]=true;});
    var files=folder.getFiles();while(files.hasNext()){var child=files.next();if(!/^[a-f0-9]{64}$/.test(child.getName()))fail_("Thư mục có tệp ngoài dự kiến.");}
  }
  var tomb=deletedRequests_(),reqHash=digest_(String(row[1])),receiptHash=digest_(receipt);
  if(!findDeleted_(tomb,1,receiptHash)){tomb.appendRow([reqHash,receiptHash]);SpreadsheetApp.flush();}
  // Trash rather than irreversible Drive deletion; preserve row until Drive operations complete.
  if(folder&&!folder.isTrashed())folder.setTrashed(true);
  if(!file.isTrashed())file.setTrashed(true);
  if(!file.isTrashed()||folder&&!folder.isTrashed())fail_("Chưa xác nhận xóa tài nguyên. Hãy thử lại.");
  sh.deleteRow(f.number);SpreadsheetApp.flush();
  if(find_(rows_(sh),0,receipt))fail_("Chưa xác nhận xóa dòng bài nộp. Hãy thử lại.");
  return {ok:true,hardDeleted:true};
}
function doPost(e){
  var lock=null;
  try{
    var raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>5*1024*1024||Utilities.newBlob(raw).getBytes().length>5*1024*1024)fail_("Yêu cầu quá lớn hoặc không hợp lệ.");
    var p=JSON.parse(raw),a=p.action;
    if(a==="teacherLogin"){teacher_(p.password);var token=id_()+id_();CacheService.getScriptCache().put("mm_session_"+digest_(token),"1",1200);return output_({ok:true,token:token,expiresIn:1200});}
    if(a==="teacherLogout"){if(typeof p.token==="string")CacheService.getScriptCache().remove("mm_session_"+digest_(p.token));return output_({ok:true});}
    if(["teacherList","createAssignment","teacherGet","teacherMedia","teacherMediaBatch","review","teacherEdit","teacherDelete","teacherPurge"].indexOf(a)>=0)teacher_(p.password,p.token);
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
    if(a==="uploadMedia"){
      var req=str_(p.requestId,120,true),secret=str_(p.clientSecret,128,true),aid=str_(p.id,64,true),hash=str_(p.hash,64,true),data=p.data;
      if(!/^[a-zA-Z0-9_-]{16,120}$/.test(req)||!/^[a-zA-Z0-9_-]{24,128}$/.test(secret)||!find_(ar,0,aid)||!dataMedia_(data,false)||data.length>4*1024*1024+100||mediaHash_(data)!==hash)fail_("Tài nguyên không hợp lệ hoặc quá lớn.");
      if(deletedRequest_(req))fail_("Bài đã được giáo viên xóa. Hãy tạo lượt nộp mới.");
      var mime=data.slice(5,data.indexOf(";")),folder=stageFolder_(req,secret,true),it=folder.getFilesByName(hash);
      if(!it.hasNext()){var files=folder.getFiles(),count=0,total=0;while(files.hasNext()){var f=files.next();count++;total+=f.getSize();}var bytes=Utilities.base64Decode(data.slice(data.indexOf(",")+1));if(count>=100||total+bytes.length>12*1024*1024)fail_("Quá giới hạn tài nguyên của bài.");folder.createFile(Utilities.newBlob(bytes,mime,hash));}
      assetData_(folder,hash,mime);return output_({ok:true,hash:hash});
    }
    if(a==="submit"){
      var aid=str_(p.id,64,true),name=str_(p.name,100,true),cls=class_(p.cls),stt=integer_(p.stt,1,50),req=str_(p.requestId,120,true),secret=str_(p.clientSecret,128,true);
      if(!/^[a-zA-Z0-9_-]{16,120}$/.test(req)||! /^[a-zA-Z0-9_-]{24,128}$/.test(secret))fail_("Mã bài không hợp lệ.");
      if(!find_(ar,0,aid))fail_("Không tìm thấy nhiệm vụ.");
      if(deletedRequest_(req))fail_("Bài đã được giáo viên xóa. Hãy tạo lượt nộp mới.");
      var existing=find_(sr,1,req);
      if(existing){if(existing.row[2]!==digest_(secret)||existing.row[3]!==aid)fail_("Mã bài không khớp.");if(existing.row[9]==="Đã xóa")fail_("Bài đã được giáo viên loại bỏ. Hãy liên hệ giáo viên.");verifyStored_(existing.row);return output_({ok:true,receipt:existing.row[0],secret:secret,duplicate:true,createdAt:iso_(existing.row[8])});}
      if(!p.project||typeof p.project!=="object")fail_("Thiếu dữ liệu sơ đồ.");
      p.project.student={name:name,cls:cls,stt:String(stt)};
      delete p.project.assetFolder;var refs=assetRefs_(p.project);if(refs.length){var staged=stageFolder_(req,secret,false);verifyAssets_(p.project,staged);p.project.assetFolder=staged.getId();}
      var project=validateProject_(p.project),folderId=props_().getProperty("MINDMAP_FOLDER_ID");
      if(!folderId)fail_("Chưa cấu hình thư mục lưu bài.");
      var key=studentKey_(aid,cls,stt), attempt=0, count=0;
      sr.forEach(function(row){if(studentKey_(String(row[3]),String(row[5]).toUpperCase(),Number(row[6]))===key){count++;attempt=Math.max(attempt,Number(row[14])||0);}});
      attempt=Math.max(attempt,count)+1;
      var receipt="MMB-"+id_(),file=DriveApp.getFolderById(folderId).createFile(Utilities.newBlob(project,"application/json",receipt+".json")),now=new Date();
      var entry=[receipt,req,digest_(secret),aid,safeCell_(name),cls,stt,file.getId(),now,"Đã nhận","","","",key,attempt,p.project.nodes.length,p.project.nodes.filter(function(n){return !!(n.image||n.imageAsset);}).length,p.project.nodes.filter(function(n){return !!(n.link||n.linkAsset);}).length,file.getUrl(),digest_(project)];
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
      var request=str_(p.requestId,120,true);if(deletedRequest_(request))fail_("Bài đã được giáo viên xóa.");var found=find_(sr,1,request);if(!found)return output_({ok:true,saved:false});
      if(found.row[2]!==digest_(str_(p.clientSecret,128,true)))fail_("Mã bài không khớp.");if(found.row[9]==="Đã xóa")fail_("Bài đã được giáo viên loại bỏ.");verifyStored_(found.row);return output_({ok:true,saved:true,receipt:String(found.row[0]),secret:p.clientSecret,createdAt:iso_(found.row[8])});
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
    if(a==="teacherPurge"){
      var receipt=str_(p.receipt,80,true),f=find_(sr,0,receipt);if(!f){if(findDeleted_(deletedRequests_(),1,digest_(receipt)))return output_({ok:true,hardDeleted:true});fail_("Không tìm thấy bài.");}return output_(purgeSubmission_(sh,sr,f));
    }
    if(a==="teacherDelete"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f)fail_("Không tìm thấy bài.");sh.getRange(f.number,10).setValue("Đã xóa");return output_({ok:true});
    }
    if(a==="teacherGet"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var project=JSON.parse(readVerified_(f.row));delete project.assetFolder;project.student={name:String(f.row[4]),cls:String(f.row[5]),stt:String(f.row[6])};return output_({ok:true,submission:submissionView_(f.row),project:project,integrity:f.row[19]?"verified":"legacy",mediaBatch:true});
    }
    if(a==="teacherMediaBatch"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      if(!Array.isArray(p.hashes)||!p.hashes.length||p.hashes.length>8)fail_("Danh sách tài nguyên không hợp lệ.");
      var project=JSON.parse(readVerified_(f.row)),refs=assetRefs_(project),map=Object.create(null);
      refs.forEach(function(r){map[r.asset.hash]=r.asset;});
      if(!project.assetFolder||p.hashes.some(function(h){return typeof h!=="string"||!map[h];}))fail_("Không tìm thấy tài nguyên.");
      var folder=DriveApp.getFolderById(project.assetFolder),items=[],total=0;
      for(var j=0;j<p.hashes.length;j++){var h=p.hashes[j],data=assetData_(folder,h,map[h].mime);if(items.length&&total+data.length>5*1024*1024)break;items.push({hash:h,data:data});total+=data.length;}
      return output_({ok:true,items:items});
    }
    if(a==="teacherMedia"){
      var f=find_(sr,0,str_(p.receipt,80,true));if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var project=JSON.parse(readVerified_(f.row)),ref=assetRefs_(project).find(function(r){return r.asset.hash===p.hash;});
      if(!ref||!project.assetFolder)fail_("Không tìm thấy tài nguyên.");
      return output_({ok:true,hash:ref.asset.hash,data:assetData_(DriveApp.getFolderById(project.assetFolder),ref.asset.hash,ref.asset.mime)});
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

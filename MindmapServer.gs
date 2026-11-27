/**
 * Mindmap Learning Studio V3.9 – dedicated Google Apps Script Web App.
 * Script properties: MINDMAP_TEACHER_PASSWORD (exactly 8 digits, stored as text),
 * MINDMAP_SPREADSHEET_ID, MINDMAP_FOLDER_ID (private Drive folder).
 * Do not reuse the script of other teaching apps.
 */
var SS_MEMO_ = null;

function doGet() { return output_({ok:true,service:"Mindmap V3.9"}); }
function output_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function fail_(message){throw new Error(message);}
function props_(){return PropertiesService.getScriptProperties();}
function cache_(){return CacheService.getScriptCache();}
function spreadsheet_(){
  if(SS_MEMO_)return SS_MEMO_;
  var id=props_().getProperty("MINDMAP_SPREADSHEET_ID");
  if(!id)fail_("Máy chủ chưa được cấu hình.");
  SS_MEMO_=SpreadsheetApp.openById(id);
  return SS_MEMO_;
}
function sheet_(name,headers){
  var ss=spreadsheet_(),sh=ss.getSheetByName(name),schemaKey="mm_schema_v39_"+ss.getId()+"_"+name;
  if(sh&&cache_().get(schemaKey)==="1")return sh;
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
  try{cache_().put(schemaKey,"1",600);}catch(e){}
  return sh;
}
function assignments_(){return sheet_("Mindmap_NhiemVu",["id","title","instructions","minBranches","minImages","minLinks","createdAt"]);}
function submissions_(){return sheet_("Mindmap_BaiNop",["receipt","requestId","secretHash","assignment","name","cls","stt","fileId","createdAt","status","score","comment","reviewedAt","studentKey","attempt","nodeCount","imageCount","linkCount","fileUrl","contentHash"]);}
function rows_(sh){var n=sh.getLastRow();return n<2?[]:sh.getRange(2,1,n-1,sh.getName()==="Mindmap_BaiNop"?20:7).getValues();}
function digest_(v){return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(v))).replace(/=+$/,"");}
function teacher_(p,token){
  if(typeof token==="string"&&/^[a-f0-9]{64}$/.test(token)&&cache_().get("mm_session_"+digest_(token))==="1")return;
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
function findRowFast_(sh,col1Based,value,colCount){
  var n=sh.getLastRow();if(n<2)return null;
  for(var attempt=0;attempt<3;attempt++){n=sh.getLastRow();if(n<2)return null;var cell=sh.getRange(2,col1Based,n-1,1).createTextFinder(String(value)).matchEntireCell(true).matchCase(true).findNext();if(!cell)return null;var rowNum=cell.getRow(),row=sh.getRange(rowNum,1,1,colCount||20).getValues()[0];if(String(row[col1Based-1])===String(value))return {row:row,number:rowNum};}fail_("Danh sách đang thay đổi. Hãy thử lại.");
}
function calcAttempt_(sh,aid,cls,stt){
  var n=sh.getLastRow();if(n<2)return 1;
  var keys=sh.getRange(2,14,n-1,2).getValues(),key=studentKey_(aid,cls,stt),attempt=0,count=0,legacy=keys.some(function(r){return !r[0];});if(!legacy){keys.forEach(function(r){if(String(r[0])===key){count++;attempt=Math.max(attempt,Number(r[1])||0);}});return Math.max(attempt,count)+1;}var vals=sh.getRange(2,4,n-1,12).getValues();
  for(var i=0;i<vals.length;i++){
    var r=vals[i];
    if(studentKey_(String(r[0]),String(r[2]).toUpperCase(),Number(r[3]))===key){count++;attempt=Math.max(attempt,Number(r[11])||0);}
  }
  return Math.max(attempt,count)+1;
}
function getAssignmentsCached_(){
  var raw=cache_().get("mm_assignments_v1");
  if(raw){try{var parsed=JSON.parse(raw);if(Array.isArray(parsed)&&parsed.length)return parsed;}catch(e){}}
  var ash=assignments_(),ar=rows_(ash);
  if(!find_(ar,0,"TIN9_B7")){
    var lock=LockService.getScriptLock();
    if(lock.tryLock(10000)){
      try{
        ar=rows_(ash);
        if(!find_(ar,0,"TIN9_B7")){
          var defaultRow=["TIN9_B7","Tin học 9 – Bài 7: Sơ đồ tư duy","Tạo sơ đồ tư duy theo yêu cầu của giáo viên.",0,0,0,new Date()];
          ash.appendRow(defaultRow);ar.push(defaultRow);
        }
      }finally{lock.releaseLock();}
    }
  }
  var list=ar.map(assignmentView_);
  try{cache_().put("mm_assignments_v1",JSON.stringify(list),300);}catch(e){}
  return list;
}
function findAssignment_(aid){
  var list=getAssignmentsCached_();
  for(var i=0;i<list.length;i++)if(list[i].id===aid)return list[i];
  return null;
}
function metaCacheKey_(receipt){return "mm_meta_"+digest_(receipt);}
function metaCacheGet_(receipt){
  var raw=cache_().get(metaCacheKey_(receipt));
  if(!raw)return null;
  try{return JSON.parse(raw);}catch(e){return null;}
}
function metaCachePut_(receipt,assetFolder,refs){
  if(!assetFolder)return;
  var allowed=Object.create(null);
  refs.forEach(function(r){allowed[r.asset.hash]=r.asset.mime;});
  try{cache_().put(metaCacheKey_(receipt),JSON.stringify({assetFolder:assetFolder,allowed:allowed}),300);}catch(e){}
}
function metaCacheDel_(receipt){try{cache_().remove(metaCacheKey_(receipt));}catch(e){}}

function mediaUrl_(v){return typeof v==="string"&&v.length<=8192&&/^https?:\/\/[^\s\x00-\x1f/@?#]+(?::[0-9]+)?(?:[/?#][^\s\x00-\x1f]*)?$/i.test(v)&&!/^https?:\/\/[^/?#]*@/i.test(v);}
function validMime_(mime,image){
  if(typeof mime!=="string"||!/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/i.test(mime))return false;
  if(image)return /^image\/(png|jpeg|jpg|gif|webp|bmp|x-icon)$/i.test(mime);
  return !/^(text\/(html|javascript)|image\/svg\+xml|application\/(xhtml\+xml|javascript|x-msdownload|x-executable|x-sh|x-bat))$/i.test(mime);
}
function dataMedia_(v,image){
  if(typeof v!=="string")return false;
  var m=/^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})$/i.exec(v);
  if(!m||m[2].length%4!==0)return false;
  return validMime_(m[1],image);
}
function readVerified_(row){
  var raw=DriveApp.getFileById(String(row[7])).getBlob().getDataAsString("UTF-8");
  if(row[19]&&digest_(raw)!==String(row[19]))fail_("Tệp bài nộp không khớp dữ liệu đã lưu. Cần kiểm tra lại.");
  return raw;
}
function stageFolder_(req,secret,create){
  var rootId=props_().getProperty("MINDMAP_FOLDER_ID");
  if(!rootId)fail_("Chưa cấu hình thư mục lưu bài.");
  var root=DriveApp.getFolderById(rootId),name="MM_assets_"+digest_(req+"|"+secret),it=root.getFoldersByName(name);
  if(it.hasNext())return it.next();
  if(!create)fail_("Chưa lưu đủ tài nguyên.");
  return root.createFolder(name);
}
function listFolderFiles_(folder){
  var map=Object.create(null),it=folder.getFiles(),count=0,total=0;
  while(it.hasNext()){var f=it.next();if(map[f.getName()])fail_("Tài nguyên bị trùng trên Drive. Cần kiểm tra.");map[f.getName()]=f;count++;total+=f.getSize();}
  return {map:map,count:count,total:total};
}
function mediaHash_(v){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,v).map(function(b){return ("0"+(b&255).toString(16)).slice(-2);}).join("");}
function assetDataFromFile_(file,hash,mime){
  if(!/^[a-f0-9]{64}$/.test(hash)||!/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/i.test(mime))fail_("Mã tài nguyên không hợp lệ.");
  var data="data:"+mime+";base64,"+Utilities.base64Encode(file.getBlob().getBytes());
  if(mediaHash_(data)!==hash)fail_("Tài nguyên không khớp dữ liệu đã lưu.");
  return data;
}
function verifyAssetOnce_(file,hash,mime){var key="mm_verified_"+digest_(file.getId()+"|"+hash+"|"+mime+"|"+file.getSize()+"|"+file.getLastUpdated().getTime());if(cache_().get(key)==="1")return;assetDataFromFile_(file,hash,mime);try{cache_().put(key,"1",600);}catch(e){}}
function assetRefs_(p){
  if(!p||!Array.isArray(p.nodes)||p.nodes.length>500)fail_("Sơ đồ không hợp lệ.");
  var refs=[];
  p.nodes.forEach(function(n){
    if(!n||typeof n!=="object")fail_("Nhánh không hợp lệ.");
    ["image","link"].forEach(function(k){
      var a=n[k+"Asset"];
      if(a){
        if(n[k]||typeof a.hash!=="string"||!/^[a-f0-9]{64}$/.test(a.hash)||typeof a.mime!=="string"||!/^[-a-z0-9.+]+\/[-a-z0-9.+]+$/i.test(a.mime))fail_("Tham chiếu tài nguyên không hợp lệ.");
        refs.push({node:n,key:k,asset:a});
      }
    });
  });
  return refs;
}
// Kiểm tra đủ tệp, dung lượng và loại MIME trong 1 lượt liệt kê thư mục (tránh tải ngược & băm lại).
function verifyAssetsFast_(p,folder){
  var listed=listFolderFiles_(folder),seen=Object.create(null),total=0;
  assetRefs_(p).forEach(function(r){
    var a=r.asset;
    if(!validMime_(a.mime,r.key==="image"))fail_("Loại tài nguyên không hợp lệ.");
    var f=listed.map[a.hash];
    if(!f)fail_("Thiếu tài nguyên đã lưu.");
    if(String(f.getMimeType()).toLowerCase()!==a.mime.toLowerCase())fail_("MIME tài nguyên không khớp.");
    if(!seen[a.hash]){
      verifyAssetOnce_(f,a.hash,a.mime);
      var sz=f.getSize();
      if(sz<=0||sz>3*1024*1024+1024)fail_("Tài nguyên vượt giới hạn.");
      seen[a.hash]=true;total+=sz;
      if(total>12*1024*1024)fail_("Tổng tài nguyên quá lớn.");
    }
  });
}
function verifyStored_(row){
  var raw=readVerified_(row),p=JSON.parse(raw);
  if(p.assetFolder)verifyAssetsFast_(p,DriveApp.getFolderById(p.assetFolder));
  return p;
}
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
function deletedRequests_(){return sheet_("Mindmap_DeletedRequests",["requestHash","receiptHash"]);}
function deletedRequest_(req){return !!findDeleted_(deletedRequests_(),0,digest_(req));}
function findDeleted_(sh,col,value){var n=sh.getLastRow();if(n<2)return null;return sh.getRange(2,col+1,n-1,1).createTextFinder(value).matchEntireCell(true).matchCase(true).findNext();}
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
    if(folder.getFolders().hasNext())fail_("Thư mục tài nguyên có nội dung ngoài dự kiến.");
    var files=folder.getFiles();while(files.hasNext()){if(!/^[a-f0-9]{64}$/.test(files.next().getName()))fail_("Thư mục có tệp ngoài dự kiến.");}
  }
  var tomb=deletedRequests_(),reqHash=digest_(String(row[1])),receiptHash=digest_(receipt);
  if(!findDeleted_(tomb,1,receiptHash)){tomb.appendRow([reqHash,receiptHash]);SpreadsheetApp.flush();}
  metaCacheDel_(receipt);
  if(folder&&!folder.isTrashed())folder.setTrashed(true);
  if(!file.isTrashed())file.setTrashed(true);
  if(!file.isTrashed()||folder&&!folder.isTrashed())fail_("Chưa xác nhận xóa tài nguyên. Hãy thử lại.");
  sh.deleteRow(f.number);SpreadsheetApp.flush();
  if(findRowFast_(sh,1,receipt,20))fail_("Chưa xác nhận xóa dòng bài nộp. Hãy thử lại.");
  return {ok:true,hardDeleted:true};
}
function loadSubmissionMeta_(receipt){
  var sh=submissions_(),f=findRowFast_(sh,1,receipt,20);
  if(!f||f.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
  var cached=metaCacheGet_(receipt);if(cached)return cached;
  var project=JSON.parse(readVerified_(f.row)),refs=assetRefs_(project);
  if(!project.assetFolder)fail_("Không tìm thấy tài nguyên.");
  var allowed=Object.create(null);
  refs.forEach(function(r){allowed[r.asset.hash]=r.asset.mime;});
  metaCachePut_(receipt,project.assetFolder,refs);
  return {assetFolder:project.assetFolder,allowed:allowed};
}

function requestLease_(req){var lock=LockService.getScriptLock();if(!lock.tryLock(10000))fail_("Hệ thống đang bận. Hãy thử lại.");try{var key="mm_lease_"+digest_(req),p=props_(),old=Number(p.getProperty(key)||0);if(old>Date.now())fail_("Bài đang được xử lý. Hãy thử lại.");p.setProperty(key,String(Date.now()+420000));return key;}finally{lock.releaseLock();}}
function releaseLease_(key){if(key)try{props_().deleteProperty(key);}catch(e){console.warn(e);}}
function doPost(e){
  SS_MEMO_=null;
  var lock=null,lease=null,tempFile=null,commitStarted=false,started=Date.now(),actionName="";
  function acquireLock_(){
    lock=LockService.getScriptLock();
    if(!lock.tryLock(15000))fail_("Hệ thống đang bận. Hãy thử lại.");
  }
  try{
    var raw=e&&e.postData&&e.postData.contents;
    if(!raw||raw.length>5*1024*1024||Utilities.newBlob(raw).getBytes().length>5*1024*1024)fail_("Yêu cầu quá lớn hoặc không hợp lệ.");
    var p=JSON.parse(raw),a=p.action;actionName=a;
    if(["uploadMedia","uploadMediaBatch","submit"].indexOf(a)>=0){var request=str_(p.requestId,120,true);if(!/^[a-zA-Z0-9_-]{16,120}$/.test(request))fail_("Mã bài không hợp lệ.");lease=requestLease_(request);}

    if(a==="teacherLogin"){
      teacher_(p.password);
      var token=id_()+id_();
      cache_().put("mm_session_"+digest_(token),"1",1200);
      return output_({ok:true,token:token,expiresIn:1200});
    }
    if(a==="teacherLogout"){
      if(typeof p.token==="string")cache_().remove("mm_session_"+digest_(p.token));
      return output_({ok:true});
    }
    if(["teacherList","createAssignment","teacherGet","teacherMedia","teacherMediaBatch","review","teacherEdit","teacherDelete","teacherPurge"].indexOf(a)>=0){
      teacher_(p.password,p.token);
    }

    // --- TÁC VỤ CHỈ ĐỌC & UPLOAD RIÊNG (KHÔNG GIỮ LOCK TOÀN CỤC) ---
    if(a==="assignment"){
      var foundAss=findAssignment_(str_(p.id,64,true));
      if(!foundAss)fail_("Không tìm thấy nhiệm vụ.");
      return output_({ok:true,assignment:foundAss});
    }
    if(a==="status"){
      var request=str_(p.requestId,120,true);
      if(deletedRequest_(request))fail_("Bài đã được giáo viên xóa.");
      var foundSt=findRowFast_(submissions_(),2,request,20);
      if(!foundSt)return output_({ok:true,saved:false});
      if(foundSt.row[2]!==digest_(str_(p.clientSecret,128,true)))fail_("Mã bài không khớp.");
      if(foundSt.row[9]==="Đã xóa")fail_("Bài đã được giáo viên loại bỏ.");
      verifyStored_(foundSt.row);
      return output_({ok:true,saved:true,receipt:String(foundSt.row[0]),secret:p.clientSecret,createdAt:iso_(foundSt.row[8])});
    }
    if(a==="feedback"){
      var fb=findRowFast_(submissions_(),1,str_(p.receipt,80,true),20);
      if(!fb||fb.row[9]==="Đã xóa"||fb.row[2]!==digest_(str_(p.secret,128,true)))fail_("Mã bài hoặc mã truy cập không đúng.");
      return output_({ok:true,feedback:{status:fb.row[9],score:fb.row[10],comment:fb.row[11]}});
    }
    if(a==="teacherList"){
      var listAss=getAssignmentsCached_(),srList=rows_(submissions_());
      return output_({ok:true,assignments:listAss,submissions:srList.filter(function(r){return r[9]!=="Đã xóa";}).map(submissionView_).reverse()});
    }
    if(a==="teacherGet"){
      var receiptGet=str_(p.receipt,80,true),fg=findRowFast_(submissions_(),1,receiptGet,20);
      if(!fg||fg.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var projectGet=JSON.parse(readVerified_(fg.row)),refsGet=assetRefs_(projectGet),inlineAssets={};
      if(projectGet.assetFolder){
        metaCachePut_(receiptGet,projectGet.assetFolder,refsGet);
        var imgRefs=refsGet.filter(function(r){return r.key==="image";});
        if(imgRefs.length){
          var listedGet=listFolderFiles_(DriveApp.getFolderById(projectGet.assetFolder)),inlineTotal=0,inlineSeen=Object.create(null);
          for(var gi=0;gi<imgRefs.length;gi++){
            var h=imgRefs[gi].asset.hash;
            if(inlineSeen[h])continue;
            inlineSeen[h]=true;
            var fileObj=listedGet.map[h];
            if(!fileObj)continue;
            var estSize=Math.ceil(fileObj.getSize()*4/3)+64;
            if(inlineTotal>0&&inlineTotal+estSize>3.6*1024*1024)break;
            var dataStr=assetDataFromFile_(fileObj,h,imgRefs[gi].asset.mime);
            inlineAssets[h]=dataStr;
            inlineTotal+=dataStr.length;
          }
        }
      }
      delete projectGet.assetFolder;
      projectGet.student={name:String(fg.row[4]),cls:String(fg.row[5]),stt:String(fg.row[6])};
      return output_({ok:true,submission:submissionView_(fg.row),project:projectGet,integrity:fg.row[19]?"verified":"legacy",mediaBatch:true,inlineAssets:inlineAssets});
    }
    if(a==="teacherMediaBatch"){
      var receiptMb=str_(p.receipt,80,true);
      if(!Array.isArray(p.hashes)||!p.hashes.length||p.hashes.length>8)fail_("Danh sách tài nguyên không hợp lệ.");
      var metaMb=loadSubmissionMeta_(receiptMb);
      if(p.hashes.some(function(h){return typeof h!=="string"||!metaMb.allowed[h];}))fail_("Không tìm thấy tài nguyên.");
      var listedMb=listFolderFiles_(DriveApp.getFolderById(metaMb.assetFolder)),items=[],totalMb=0;
      for(var j=0;j<p.hashes.length;j++){
        var hashMb=p.hashes[j],fMb=listedMb.map[hashMb];
        if(!fMb)fail_("Thiếu tài nguyên đã lưu.");
        var dataMb=assetDataFromFile_(fMb,hashMb,metaMb.allowed[hashMb]);
        if(items.length&&totalMb+dataMb.length>5*1024*1024)break;
        items.push({hash:hashMb,data:dataMb});totalMb+=dataMb.length;
      }
      return output_({ok:true,items:items});
    }
    if(a==="teacherMedia"){
      var receiptM=str_(p.receipt,80,true),hashM=str_(p.hash,64,true),metaM=loadSubmissionMeta_(receiptM);
      if(!metaM.allowed[hashM])fail_("Không tìm thấy tài nguyên.");
      var itM=DriveApp.getFolderById(metaM.assetFolder).getFilesByName(hashM);
      if(!itM.hasNext())fail_("Thiếu tài nguyên đã lưu.");
      return output_({ok:true,hash:hashM,data:assetDataFromFile_(itM.next(),hashM,metaM.allowed[hashM])});
    }
    if(a==="uploadMediaBatch"){
      var reqB=str_(p.requestId,120,true),secretB=str_(p.clientSecret,128,true),aidB=str_(p.id,64,true);
      if(!/^[a-zA-Z0-9_-]{16,120}$/.test(reqB)||!/^[a-zA-Z0-9_-]{24,128}$/.test(secretB)||!findAssignment_(aidB)||!Array.isArray(p.items)||!p.items.length||p.items.length>8)fail_("Tài nguyên không hợp lệ.");
      if(deletedRequest_(reqB))fail_("Bài đã được giáo viên xóa. Hãy tạo lượt nộp mới.");
      var prepared=[],seenB=Object.create(null);
      p.items.forEach(function(x){
        if(!x||typeof x.hash!=="string"||!/^[a-f0-9]{64}$/.test(x.hash)||seenB[x.hash]||!dataMedia_(x.data,false)||x.data.length>4*1024*1024+100||mediaHash_(x.data)!==x.hash)fail_("Tài nguyên không hợp lệ.");
        seenB[x.hash]=true;
        prepared.push({hash:x.hash,mime:x.data.slice(5,x.data.indexOf(";")),bytes:Utilities.base64Decode(x.data.slice(x.data.indexOf(",")+1))});
      });
      var folderB=stageFolder_(reqB,secretB,true),listedB=listFolderFiles_(folderB),countB=listedB.count,totalB=listedB.total;
      prepared.forEach(function(x){if(!listedB.map[x.hash]){countB++;totalB+=x.bytes.length;}});
      if(countB>100||totalB>12*1024*1024)fail_("Quá giới hạn tài nguyên của bài.");
      prepared.forEach(function(x){
        if(!listedB.map[x.hash]){
          var created=folderB.createFile(Utilities.newBlob(x.bytes,x.mime,x.hash));
          if(created.getSize()!==x.bytes.length)fail_("Chưa xác nhận được kích thước tài nguyên.");verifyAssetOnce_(created,x.hash,x.mime);
        }else verifyAssetOnce_(listedB.map[x.hash],x.hash,x.mime);
      });
      return output_({ok:true,hashes:prepared.map(function(x){return x.hash;})});
    }
    if(a==="uploadMedia"){
      var reqU=str_(p.requestId,120,true),secretU=str_(p.clientSecret,128,true),aidU=str_(p.id,64,true),hashU=str_(p.hash,64,true),dataU=p.data;
      if(!/^[a-zA-Z0-9_-]{16,120}$/.test(reqU)||!/^[a-zA-Z0-9_-]{24,128}$/.test(secretU)||!findAssignment_(aidU)||!dataMedia_(dataU,false)||dataU.length>4*1024*1024+100||mediaHash_(dataU)!==hashU)fail_("Tài nguyên không hợp lệ hoặc quá lớn.");
      if(deletedRequest_(reqU))fail_("Bài đã được giáo viên xóa. Hãy tạo lượt nộp mới.");
      var mimeU=dataU.slice(5,dataU.indexOf(";")),folderU=stageFolder_(reqU,secretU,true),listedU=listFolderFiles_(folderU);
      if(!listedU.map[hashU]){
        var bytesU=Utilities.base64Decode(dataU.slice(dataU.indexOf(",")+1));
        if(listedU.count>=100||listedU.total+bytesU.length>12*1024*1024)fail_("Quá giới hạn tài nguyên của bài.");
        var createdU=folderU.createFile(Utilities.newBlob(bytesU,mimeU,hashU));
        if(createdU.getSize()!==bytesU.length)fail_("Chưa xác nhận được kích thước tài nguyên.");verifyAssetOnce_(createdU,hashU,mimeU);
      }else verifyAssetOnce_(listedU.map[hashU],hashU,mimeU);
      return output_({ok:true,hash:hashU});
    }

    // --- NỘP BÀI: GHI DRIVE TRƯỚC, CHỈ KHÓA KHI GHI SHEET (~0.3s) ---
    if(a==="submit"){
      var aid=str_(p.id,64,true),name=str_(p.name,100,true),cls=class_(p.cls),stt=integer_(p.stt,1,50),req=str_(p.requestId,120,true),secret=str_(p.clientSecret,128,true);
      if(!/^[a-zA-Z0-9_-]{16,120}$/.test(req)||!/^[a-zA-Z0-9_-]{24,128}$/.test(secret))fail_("Mã bài không hợp lệ.");
      if(!findAssignment_(aid))fail_("Không tìm thấy nhiệm vụ.");
      if(deletedRequest_(req))fail_("Bài đã được giáo viên xóa. Hãy tạo lượt nộp mới.");
      var shSub=submissions_(),preExisting=findRowFast_(shSub,2,req,20);
      if(preExisting){
        if(preExisting.row[2]!==digest_(secret)||preExisting.row[3]!==aid)fail_("Mã bài không khớp.");
        if(preExisting.row[9]==="Đã xóa")fail_("Bài đã được giáo viên loại bỏ. Hãy liên hệ giáo viên.");
        verifyStored_(preExisting.row);
        return output_({ok:true,receipt:preExisting.row[0],secret:secret,duplicate:true,createdAt:iso_(preExisting.row[8])});
      }
      if(!p.project||typeof p.project!=="object")fail_("Thiếu dữ liệu sơ đồ.");
      p.project.student={name:name,cls:cls,stt:String(stt)};
      delete p.project.assetFolder;
      var refs=assetRefs_(p.project);
      if(refs.length){
        var staged=stageFolder_(req,secret,false);
        verifyAssetsFast_(p.project,staged);
        p.project.assetFolder=staged.getId();
      }
      var project=validateProject_(p.project),folderId=props_().getProperty("MINDMAP_FOLDER_ID");
      if(!folderId)fail_("Chưa cấu hình thư mục lưu bài.");
      var receipt="MMB-"+id_(),blob=Utilities.newBlob(project,"application/json",receipt+".json"),expectedSize=blob.getBytes().length;
      var file=DriveApp.getFolderById(folderId).createFile(blob);tempFile=file;
      if(file.getSize()!==expectedSize){try{file.setTrashed(true);}catch(ex){}fail_("Chưa xác nhận được tệp bài nộp.");}
      var projectHash=digest_(project);if(digest_(file.getBlob().getDataAsString("UTF-8"))!==projectHash)fail_("Tệp lưu không khớp.");var nodeCount=p.project.nodes.length;
      var imgCount=p.project.nodes.filter(function(n){return !!(n.image||n.imageAsset);}).length;
      var lnkCount=p.project.nodes.filter(function(n){return !!(n.link||n.linkAsset);}).length;

      acquireLock_();
      if(deletedRequest_(req)){try{file.setTrashed(true);}catch(ex){}fail_("Bài đã được giáo viên xóa. Hãy tạo lượt nộp mới.");}
      var existing=findRowFast_(shSub,2,req,20);
      if(existing){
        try{file.setTrashed(true);}catch(ex){}
        if(existing.row[2]!==digest_(secret)||existing.row[3]!==aid)fail_("Mã bài không khớp.");
        if(existing.row[9]==="Đã xóa")fail_("Bài đã được giáo viên loại bỏ. Hãy liên hệ giáo viên.");
        verifyStored_(existing.row);
        return output_({ok:true,receipt:existing.row[0],secret:secret,duplicate:true,createdAt:iso_(existing.row[8])});
      }
      var key=studentKey_(aid,cls,stt),attempt=calcAttempt_(shSub,aid,cls,stt),now=new Date();
      var entry=[receipt,req,digest_(secret),aid,safeCell_(name),cls,stt,file.getId(),now,"Đã nhận","","","",key,attempt,nodeCount,imgCount,lnkCount,file.getUrl(),projectHash];
      try{
        commitStarted=true;shSub.appendRow(entry);SpreadsheetApp.flush();
        var committed=findRowFast_(shSub,2,req,20);
        if(!committed||String(committed.row[0])!==receipt||String(committed.row[7])!==file.getId())fail_("Chưa xác nhận được dữ liệu bài nộp.");
      }catch(err){
        console.error("Mindmap commit uncertain",receipt,err);
        fail_("Chưa xác nhận được bài nộp. Hãy kiểm tra trạng thái hoặc gửi lại.");
      }
      return output_({ok:true,receipt:receipt,secret:secret,createdAt:now.toISOString(),attempt:attempt});
    }

    // --- CÁC TÁC VỤ GHI CỦA GIÁO VIÊN (GIỮ LOCK NGẮN) ---
    acquireLock_();
    if(a==="createAssignment"){
      var ash=assignments_();
      var row=["MM-"+id_().slice(0,12),str_(p.title,150,true),str_(p.instructions,4000,true),integer_(p.minBranches,0,500),integer_(p.minImages,0,500),integer_(p.minLinks,0,500),new Date()];
      ash.appendRow(row.map(function(v,i){return i===1||i===2?safeCell_(v):v;}));
      try{cache_().remove("mm_assignments_v1");}catch(ex){}
      return output_({ok:true,assignment:assignmentView_(row)});
    }
    var sh=submissions_();
    if(a==="teacherEdit"){
      var fe=findRowFast_(sh,1,str_(p.receipt,80,true),20);
      if(!fe||fe.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var nmE=str_(p.name,100,true),clE=class_(p.cls),stE=integer_(p.stt,1,50);
      sh.getRange(fe.number,5,1,3).setValues([[safeCell_(nmE),clE,stE]]);
      sh.getRange(fe.number,14).setValue(studentKey_(fe.row[3],clE,stE));
      SpreadsheetApp.flush();
      return output_({ok:true});
    }
    if(a==="teacherPurge"){
      var receiptP=str_(p.receipt,80,true),srP=rows_(sh),fp=find_(srP,0,receiptP);
      if(!fp){
        if(findDeleted_(deletedRequests_(),1,digest_(receiptP)))return output_({ok:true,hardDeleted:true});
        fail_("Không tìm thấy bài.");
      }
      if(Number(props_().getProperty("mm_lease_"+digest_(String(fp.row[1])))||0)>Date.now())fail_("Bài đang được xử lý. Hãy thử lại.");return output_(purgeSubmission_(sh,srP,fp));
    }
    if(a==="teacherDelete"){
      var receiptD=str_(p.receipt,80,true),fd=findRowFast_(sh,1,receiptD,20);
      if(!fd)fail_("Không tìm thấy bài.");
      sh.getRange(fd.number,10).setValue("Đã xóa");
      metaCacheDel_(receiptD);
      return output_({ok:true});
    }
    if(a==="review"){
      var fr=findRowFast_(sh,1,str_(p.receipt,80,true),20);
      if(!fr||fr.row[9]==="Đã xóa")fail_("Không tìm thấy bài.");
      var score=p.score===""?"":Number(p.score),status=str_(p.status,60,true),comment=str_(p.comment,4000,false);
      if(score!==""&&(!isFinite(score)||score<0||score>10))fail_("Điểm phải từ 0 đến 10.");
      if(["Đã nhận","Yêu cầu chỉnh sửa","Đã đánh giá"].indexOf(status)<0)fail_("Trạng thái không hợp lệ.");
      sh.getRange(fr.number,10,1,4).setValues([[status,score,safeCell_(comment),new Date()]]);SpreadsheetApp.flush();
      return output_({ok:true});
    }
    fail_("Yêu cầu không được hỗ trợ.");
  }catch(err){
    console.error(err);
    return output_({ok:false,error:err.message||"Không thực hiện được."});
  }finally{
    if(lock&&lock.hasLock())lock.releaseLock();
    if(tempFile&&!commitStarted)try{if(!tempFile.isTrashed())tempFile.setTrashed(true);}catch(e){console.warn(e);}
    releaseLease_(lease);console.log("Mindmap "+actionName+" ms="+(Date.now()-started));
  }
}
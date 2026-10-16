/* Disposable real WordPress integration. WP_SOURCE and PIRATEZ_ADDONS_SOURCE
 * point to source trees; installs/upgrades only temporary copies. */
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('node:assert/strict');
const {spawn,execFileSync}=require('child_process'); const {chromium}=require('playwright');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'piratez-releases-'));
const manager=path.resolve(__dirname,'..'), theme=process.env.PIRATEZ_THEME_SOURCE, addons=process.env.PIRATEZ_ADDONS_SOURCE;
if(!theme) throw Error('PIRATEZ_THEME_SOURCE required');
if(!process.env.WP_SOURCE||!addons) throw Error('WP_SOURCE and PIRATEZ_ADDONS_SOURCE required');
fs.cpSync(process.env.WP_SOURCE,path.join(tmp,'site'),{recursive:true});
const fixtures=path.join(tmp,'fixtures'); fs.mkdirSync(fixtures);
for(const [slug,source] of [['piratez-manager',manager],['piratez-cyberpunk',theme],...['piratez-image-optimize','piratez-cookie-consent'].map(s=>[s,path.join(addons,s)])]) {
 for(const future of [false,true]) {
  const root=path.join(tmp,slug+(future?'-future':'-current')); fs.cpSync(source,root,{recursive:true});
  const cfg=JSON.parse(fs.readFileSync(path.join(root,'release-config.json')));
  if(future) {
   const old=fs.readFileSync(path.join(root,'readme.txt'),'utf8').match(/^Stable tag: (.+)$/m)[1],parts=old.split('.').map(Number);parts[2]++;const next=parts.join('.');
   for(const file of new Set([cfg.entry,cfg.type==='theme'?'functions.php':cfg.entry,'readme.txt'])) {
    const target=path.join(root,file); fs.writeFileSync(target,fs.readFileSync(target,'utf8').replaceAll(old,next));
   }
  }
  execFileSync('python3',['tools/build_release.py'],{cwd:root});
  const dest=path.join(fixtures,slug,future?'future':'current'); fs.mkdirSync(dest,{recursive:true});
  for(const file of [slug+'.zip','release.json'])fs.copyFileSync(path.join(root,'dist',file),path.join(dest,file));
  if(['piratez-manager','piratez-cyberpunk'].includes(slug)&&!future) execFileSync('python3',['-m','zipfile','-e',path.join(dest,slug+'.zip'),path.join(tmp,'site/wp-content',slug==='piratez-cyberpunk'?'themes':'plugins')]);
 }
}
if(process.env.PIRATEZ_PREVIOUS_THEME_SOURCE) {fs.rmSync(path.join(tmp,'site/wp-content/themes/piratez-cyberpunk'),{recursive:true,force:true});fs.cpSync(process.env.PIRATEZ_PREVIOUS_THEME_SOURCE,path.join(tmp,'site/wp-content/themes/piratez-cyberpunk'),{recursive:true});}
fs.mkdirSync(path.join(tmp,'site/wp-content/mu-plugins'),{recursive:true});
fs.writeFileSync(path.join(tmp,'site/wp-content/mu-plugins/release-fixture.php'),`<?php
register_shutdown_function(function(){ $e=error_get_last(); if($e && in_array($e['type'],array(E_ERROR,E_PARSE,E_CORE_ERROR,E_COMPILE_ERROR),true)) echo '<pre>'.json_encode($e).'</pre>'; });
add_filter('file_mod_allowed',function($allowed){return get_option('fixture_file_mods',true)?$allowed:false;});
add_filter('pre_http_request', function($pre,$args,$url) {
 $repos=array('spaniakos/piratez-manager'=>'piratez-manager','spaniakos/Piratez.gr-Theme'=>'piratez-cyberpunk','spaniakos/piratez-image-optimize'=>'piratez-image-optimize','spaniakos/piratez-cookie-consent'=>'piratez-cookie-consent');
 foreach($repos as $repo=>$slug) {
  if(strpos($url,'https://api.github.com/repos/'.$repo.'/')!==0 && strpos($url,'https://github.com/'.$repo.'/releases/')!==0)continue;
  $mode=get_option('fixture_mode','current'); $scenario=get_option('fixture_scenario','');
  $root='/fixtures/'.$slug.'/'.$mode.'/'; $data=json_decode(file_get_contents($root.'release.json'),true); $tag='v'.$data['version'];
  $base='https://github.com/'.$repo.'/releases/download/'.$tag.'/';
  $release=array('tag_name'=>$tag,'draft'=>false,'prerelease'=>$scenario==='prerelease','body'=>'Fixture notes','assets'=>array(array('name'=>$slug.'.zip','browser_download_url'=>$base.$slug.'.zip','state'=>'uploaded','digest'=>'sha256:'.$data['sha256']),array('name'=>'release.json','browser_download_url'=>$base.'release.json','state'=>'uploaded')));
  if($scenario==='origin') $release['assets'][0]['browser_download_url']='https://example.com/evil.zip';
  if($scenario==='digest') $release['assets'][0]['digest']='sha256:'.str_repeat('0',64);
  if($scenario==='incompatible') $data['requires']='99.0';
  if($scenario==='identity') $data['slug']='evil';
  if($scenario==='malformed') $release['tag_name']=array('bad');
  if($scenario==='offline')return new WP_Error('fixture_offline','GitHub is unavailable.');
  if($scenario==='missing')return array('headers'=>array(),'body'=>'{}','response'=>array('code'=>404,'message'=>'Not Found'),'cookies'=>array());
  if(str_ends_with($url,'/latest')) $body=wp_json_encode($release);
  elseif(str_ends_with($url,'/release.json')) $body=wp_json_encode($data);
  elseif(str_ends_with($url,'.zip')) { $body=file_get_contents($root.$slug.'.zip'); if($scenario==='tamper') $body.='bad'; }
  else return new WP_Error('fixture_url','Unexpected fixture URL');
  if(!empty($args['stream'])) { file_put_contents($args['filename'],$body); $body=''; }
  return array('headers'=>array('content-type'=>'application/octet-stream'),'body'=>$body,'response'=>array('code'=>200,'message'=>'OK'),'cookies'=>array());
 }
 if(strpos($url,'api.wordpress.org')!==false) return array('headers'=>array(),'body'=>wp_json_encode(array('offers'=>array(),'plugins'=>array(),'themes'=>array(),'no_update'=>array(),'translations'=>array())),'response'=>array('code'=>200,'message'=>'OK'),'cookies'=>array());
 return $pre;
},10,3);
`);
const endpoint=`<?php require __DIR__.'/wp-load.php';
require_once ABSPATH.'wp-admin/includes/plugin.php';
header('Content-Type: application/json');
$action=$_GET['action']??'';
if($action==='fixture') { update_option('fixture_mode',$_GET['mode']??'current');update_option('fixture_scenario',$_GET['scenario']??''); foreach(array('spaniakos/piratez-manager','spaniakos/Piratez.gr-Theme','spaniakos/piratez-image-optimize','spaniakos/piratez-cookie-consent') as $repo)delete_site_transient('piratez_release_'.md5($repo)); }
if($action==='state') {wp_clean_plugins_cache();wp_clean_themes_cache(); echo wp_json_encode(array('theme'=>wp_get_theme()->get('Version'),'plugins'=>get_plugins(),'active'=>get_option('active_plugins'),'keep'=>get_option('fixture_keep'),'theme_keep'=>get_theme_mod('fixture_keep'),'manager'=>defined('PIRATEZ_MANAGER_VERSION')?PIRATEZ_MANAGER_VERSION:null,'legacy'=>function_exists('piratez_components'),'wp'=>$GLOBALS['wp_version']));exit;}
if($action==='release') {$r=piratez_manager_clients()[$_GET['id']]->release(true); echo wp_json_encode(is_wp_error($r)?array('error'=>$r->get_error_code()):$r);exit;}
if($action==='native') {delete_site_transient('update_plugins');delete_site_transient('update_themes');wp_update_plugins();wp_update_themes();echo wp_json_encode(array('plugins'=>get_site_transient('update_plugins'),'themes'=>get_site_transient('update_themes')));exit;}
if($action==='rename-plugin') {deactivate_plugins('piratez-image-optimize/piratez-image-optimize.php');rename(WP_PLUGIN_DIR.'/piratez-image-optimize',WP_PLUGIN_DIR.'/image-optimize-custom');wp_clean_plugins_cache();}
if($action==='keep') {update_option('fixture_keep','preserved');set_theme_mod('fixture_keep','preserved');}
if($action==='deactivate-manager') {deactivate_plugins('piratez-manager/piratez-manager.php');}
if($action==='activate-manager') {activate_plugin('piratez-manager/piratez-manager.php');}
if($action==='deactivate-image') {deactivate_plugins('image-optimize-custom/piratez-image-optimize.php');}
if($action==='nonce') {wp_set_current_user(1);echo wp_json_encode(array('nonce'=>wp_create_nonce('piratez_manager_component_piratez-manager_update')));exit;}
if($action==='create-user') {wp_insert_user(array('user_login'=>'limited','user_pass'=>'limited-test-password','role'=>'editor'));}
if($action==='file-mods') {update_option('fixture_file_mods',($_GET['value']??'')==='1'?'1':'0');}
if($action==='switch-back') {switch_theme('piratez-cyberpunk');}
if($action==='switch') {switch_theme('twentytwentyfive');}
if($action==='plugin-native') {delete_site_transient('update_plugins');wp_update_plugins();echo wp_json_encode(get_site_transient('update_plugins'));exit;}
if($action==='checksum') {require_once ABSPATH.'wp-admin/includes/class-wp-upgrader.php'; $client=piratez_manager_clients()['theme'];$release=$client->release(true);$r=$client->download(false,$release['package'],new Theme_Upgrader(new WP_Ajax_Upgrader_Skin()),array('theme'=>get_template()));echo wp_json_encode(is_wp_error($r)?array('error'=>$r->get_error_code()):array('file'=>$r));exit;}
if($action==='source-identity') {require_once ABSPATH.'wp-admin/includes/class-wp-upgrader.php';require_once ABSPATH.'wp-admin/includes/file.php';WP_Filesystem();$client=piratez_manager_clients()['theme'];$release=$client->release(true);$upgrader=new Theme_Upgrader(new WP_Ajax_Upgrader_Skin());$file=$client->download(false,$release['package'],$upgrader,array());$source=get_temp_dir().'identity-check/piratez-cyberpunk/';wp_mkdir_p($source);file_put_contents($source.'style.css',"/* Version: 0.0.0\nUpdate URI: https://github.com/spaniakos/Piratez.gr-Theme\n*/");$r=$client->source($source,dirname($source),$upgrader,array());if(is_string($file))unlink($file);echo wp_json_encode(array('error'=>is_wp_error($r)?$r->get_error_code():'none'));exit;}
if($action==='denied-download') {require_once ABSPATH.'wp-admin/includes/class-wp-upgrader.php';$r=piratez_manager_clients()['theme']->download(false,'https://example.com/evil.zip',new Theme_Upgrader(new WP_Ajax_Upgrader_Skin()),array('theme'=>get_template()));echo wp_json_encode(array('error'=>$r->get_error_code()));exit;}
echo '{}';`;
fs.writeFileSync(path.join(tmp,'site/release-test.php'),endpoint);
const blueprint={steps:[{step:'defineWpConfigConsts',consts:{WP_DEBUG:true,WP_DEBUG_DISPLAY:true,WP_DISABLE_FATAL_ERROR_HANDLER:true}},{step:'runPHP',code:"<?php require '/wordpress/wp-load.php';switch_theme('piratez-cyberpunk');require_once ABSPATH.'wp-admin/includes/plugin.php';activate_plugin('piratez-manager/piratez-manager.php');"}]};
fs.writeFileSync(path.join(tmp,'blueprint.json'),JSON.stringify(blueprint));
const cli=path.join(path.dirname(require.resolve('@wp-playground/cli/package.json')),'wp-playground.js');
(async()=>{
 const server=spawn('node',[cli,'server','--php=8.3','--wordpress-install-mode=install-from-existing-files','--mount-before-install',path.join(tmp,'site')+':/wordpress','--mount',fixtures+':/fixtures','--blueprint',path.join(tmp,'blueprint.json'),'--login','--port=9401','--workers=1']);
 let logs=''; server.stdout.on('data',d=>logs+=d); server.stderr.on('data',d=>logs+=d);let browser;
 try {
  await new Promise((res,rej)=>{const until=Date.now()+45000,t=setInterval(()=>{if(logs.includes('Ready!')){clearInterval(t);res();}else if(Date.now()>until){clearInterval(t);rej(Error(logs));}},100);server.once('exit',()=>{clearInterval(t);rej(Error(logs));});});
  browser=await chromium.launch({headless:true,executablePath:process.env.PIRATEZ_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
  const context=await browser.newContext(),page=await context.newPage(),base='http://127.0.0.1:9401';
  const request=async params=>{const r=await context.request.get(base+'/release-test.php?'+new URLSearchParams(params));const body=await r.text();try{return JSON.parse(body);}catch{throw Error(body.slice(0,4000));}};
  await page.goto(base+'/wp-admin/admin.php?page=piratez-manager');
  if(page.url().includes('wp-login.php')) {await page.locator('#user_login').fill('admin');await page.locator('#user_pass').fill('password');await Promise.all([page.waitForURL(u=>!u.href.includes('wp-login.php')),page.locator('#wp-submit').click()]);}
  const operation=async(id,op)=>{console.log('Testing '+id+' '+op);await page.goto(base+'/wp-admin/admin.php?page=piratez-manager');const form=page.locator('form').filter({has:page.locator('input[name="component"][value="'+id+'"]')}).filter({has:page.locator('input[name="operation"][value="'+op+'"]')});assert.equal(await form.count(),1,id+' '+op+'\n'+await page.locator('body').innerText());await Promise.all([page.waitForNavigation({waitUntil:'domcontentloaded'}),form.locator('button,input[type=submit]').click()]);const notice=await page.locator('.notice p').allTextContents();assert.ok(notice.some(s=>/installed|activated|completed|refreshed/i.test(s)),id+' '+op+' URL '+page.url()+'\n'+(await page.locator('body').innerText()).slice(0,5000));assert.equal(await page.locator('.notice-error').count(),0,notice.join('\n'));};
  assert.equal((await request({action:'state'})).wp,'7.1.3');
  assert.equal(await page.locator('#menu-appearance a[href="themes.php?page=piratez-components"]').count(),0);
  if(process.env.PIRATEZ_PREVIOUS_THEME_SOURCE) {
   let initial=await request({action:'state'});assert.equal(initial.theme,'1.2.0');assert.equal(initial.manager,'1.0.0');
   await operation('theme','update');assert.equal((await request({action:'state'})).theme,'1.3.0');
  }
  assert.equal((await request({action:'state'})).legacy,false,'theme handoff must not load legacy functions');
  const stale=await context.request.post(base+'/wp-admin/admin-post.php',{form:{action:'piratez_component',component:'theme',operation:'check'}});assert.equal(stale.status(),400);
  for(const slug of ['piratez-image-optimize','piratez-cookie-consent']) {await operation(slug,'install');let state=await request({action:'state'});assert.ok(state.plugins[slug+'/'+slug+'.php']);assert.ok(!state.active.includes(slug+'/'+slug+'.php'));await operation(slug,'activate');}
  await request({action:'rename-plugin'});await operation('piratez-image-optimize','activate');await request({action:'keep'});await request({action:'fixture',mode:'future'});
  let native=await request({action:'native'});assert.equal(native.themes.response['piratez-cyberpunk'].new_version??native.themes.response['piratez-cyberpunk'].version,'1.3.1');
  for(const slug of ['piratez-image-optimize','piratez-cookie-consent']){assert.equal(native.plugins.response[(slug==='piratez-image-optimize'?'image-optimize-custom':slug)+'/'+slug+'.php'].new_version,'1.1.1');await operation(slug,'update');}
  await operation('theme','update');await operation('piratez-manager','update');let state=await request({action:'state'});assert.equal(state.theme,'1.3.1');assert.equal(state.manager,'1.0.1');assert.ok(state.active.includes('piratez-manager/piratez-manager.php'));assert.ok(state.active.includes('image-optimize-custom/piratez-image-optimize.php'));assert.ok(state.active.includes('piratez-cookie-consent/piratez-cookie-consent.php'));assert.equal(state.keep,'preserved');assert.equal(state.theme_keep,'preserved');
  for(const slug of ['piratez-image-optimize','piratez-cookie-consent'])assert.equal(state.plugins[(slug==='piratez-image-optimize'?'image-optimize-custom':slug)+'/'+slug+'.php'].Version,'1.1.1');
  for(const [scenario,code] of [['prerelease','piratez_release_version'],['origin','piratez_release_assets'],['digest','piratez_release_digest'],['identity','piratez_release_manifest'],['malformed','piratez_release_version']]) {await request({action:'fixture',mode:'future',scenario});assert.equal((await request({action:'release',id:'theme'})).error,code);}
  await request({action:'fixture',mode:'future',scenario:'incompatible'});await page.goto(base+'/wp-admin/admin.php?page=piratez-manager');assert.ok((await page.locator('body').innerText()).includes('Requires WordPress 99.0'));assert.equal(await page.getByRole('button',{name:'Update now',exact:true}).count(),0);
  await request({action:'fixture',mode:'future',scenario:'tamper'});
  assert.equal((await request({action:'checksum'})).error,'piratez_package_checksum');
  // Administrative actions also require valid per-operation nonces.
  const failure=await context.request.post(base+'/wp-admin/admin-post.php',{form:{action:'piratez_manager_component',component:'theme',operation:'update',_wpnonce:'invalid'}});assert.equal(failure.status(),403);
  assert.equal((await request({action:'denied-download'})).error,'piratez_package_origin');
  await request({action:'fixture',mode:'future'});
  assert.equal((await request({action:'source-identity'})).error,'piratez_package_identity');
  await request({action:'fixture',mode:'future',scenario:'offline'});
  await page.goto(base+'/wp-admin/admin.php?page=piratez-manager');assert.ok((await page.locator('body').innerText()).includes('GitHub is unavailable.'));assert.equal((await request({action:'state'})).theme,'1.3.1');
  await request({action:'fixture',mode:'future',scenario:'missing'});
  assert.equal((await request({action:'release',id:'piratez-manager'})).error,'piratez_release_http');
  await request({action:'fixture',mode:'future'});
  await request({action:'create-user'});
  const limited=await browser.newContext();await limited.request.post(base+'/wp-login.php',{form:{log:'limited',pwd:'limited-test-password','wp-submit':'Log In'}});
  const denied=await limited.request.post(base+'/wp-admin/admin-post.php',{form:{action:'piratez_manager_component',component:'theme',operation:'update'}});assert.equal(denied.status(),403);await limited.close();
  // No file modification permission: reads and activation are still usable.
  await request({action:'deactivate-image'});await request({action:'file-mods',value:'0'});
  await operation('piratez-image-optimize','activate');
  await page.goto(base+'/wp-admin/admin.php?page=piratez-manager');assert.equal(await page.getByRole('button',{name:'Install module',exact:true}).count(),0);
  await operation('piratez-manager','check');
  const nonce=(await request({action:'nonce'})).nonce;
  const readonly=await context.request.post(base+'/wp-admin/admin-post.php',{form:{action:'piratez_manager_component',component:'piratez-manager',operation:'update',_wpnonce:nonce}});assert.equal(readonly.status(),403);
  await request({action:'file-mods',value:'1'});
  await request({action:'deactivate-manager'});
  await page.goto(base+'/wp-admin/themes.php?page=piratez-components');
  assert.equal(await page.locator('h1').innerText(),'PirateZ Updates & Modules');
  state=await request({action:'state'});assert.equal(state.manager,null);assert.equal(state.legacy,true);
  native=await request({action:'native'});assert.ok(native.themes.no_update['piratez-cyberpunk']);
  await request({action:'activate-manager'});await request({action:'switch'});
  await page.goto(base+'/wp-admin/admin.php?page=piratez-manager');assert.equal(await page.locator('h1').innerText(),'PirateZ Manager');
  state=await request({action:'state'});assert.notEqual(state.theme,'1.3.1');assert.equal(state.legacy,false);
  const independent=await request({action:'plugin-native'});assert.ok(independent.no_update['image-optimize-custom/piratez-image-optimize.php']);assert.ok(independent.no_update['piratez-cookie-consent/piratez-cookie-consent.php']);assert.ok(independent.no_update['piratez-manager/piratez-manager.php']);
  await request({action:'deactivate-manager'});
  const without=await request({action:'plugin-native'});assert.ok(without.no_update['image-optimize-custom/piratez-image-optimize.php']);assert.ok(without.no_update['piratez-cookie-consent/piratez-cookie-consent.php']);
  await request({action:'switch-back'});await request({action:'activate-manager'});
  assert.equal((await request({action:'state'})).theme_keep,'preserved');
  console.log('PASS: WordPress 7.1.3; old/new theme handoff; install/activate/update; Manager self-update; renamed addon; nonce and package denials; file-mod restrictions; deactivate rollback; standard theme; independent updates; saved settings.');
 }finally{if(browser)await browser.close();server.kill('SIGTERM');setTimeout(()=>server.kill('SIGKILL'),1000).unref();}
})().catch(e=>{console.error(e);process.exitCode=1;});

// Windows runtime essentials only. Artifact download/auth stays in a separate process.
const allowed=new Set([
 'systemroot','windir','systemdrive','comspec','path','pathext','temp','tmp',
 'userprofile','appdata','localappdata','homedrive','homepath','programdata',
 'programfiles','programfiles(x86)','programw6432','commonprogramfiles',
 'commonprogramfiles(x86)','commonprogramw6432','processor_architecture',
 'processor_identifier','number_of_processors','os','lang','lc_all','tz'
]);
function sanitizedAppEnv(input=process.env){
 return Object.fromEntries(Object.entries(input).filter(([name,value])=>allowed.has(name.toLowerCase())&&typeof value==='string'));
}
module.exports={sanitizedAppEnv};

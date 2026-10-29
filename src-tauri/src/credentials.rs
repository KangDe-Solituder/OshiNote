// DPAPI binds saved passwords to the current Windows account. Never included in backups.
#[tauri::command]
pub fn protect_connection_secret(secret: String) -> Result<Vec<u8>, String> {
    if secret.len() > 65536 { return Err("Credential exceeds size limit".into()); }
    crypt(secret.as_bytes(), true)
}
#[tauri::command]
pub fn unprotect_connection_secret(encrypted: Vec<u8>) -> Result<String, String> {
    if encrypted.len() > 131072 { return Err("Invalid protected credential".into()); }
    String::from_utf8(crypt(&encrypted, false)?).map_err(|_| "Invalid credential encoding".into())
}
#[cfg(target_os = "windows")]
fn crypt(bytes: &[u8], protect: bool) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{Security::Cryptography::*, Foundation::LocalFree};
    let input = CRYPT_INTEGER_BLOB { cbData: bytes.len() as u32, pbData: bytes.as_ptr() as *mut u8 };
    let mut output = CRYPT_INTEGER_BLOB { cbData: 0, pbData: std::ptr::null_mut() };
    // Windows owns output; copy it before LocalFree. Input remains live for this synchronous call.
    unsafe {
        let ok = if protect {
            CryptProtectData(&input, std::ptr::null(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output)
        } else {
            CryptUnprotectData(&input, std::ptr::null_mut(), std::ptr::null(), std::ptr::null(), std::ptr::null(), CRYPTPROTECT_UI_FORBIDDEN, &mut output)
        };
        if ok == 0 { return Err("无法解锁本机连接凭据，请重新编辑密码 / Unable to unlock this device credential. Re-enter the password.".into()); }
        let result = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        LocalFree(output.pbData as *mut _);
        Ok(result)
    }
}
#[cfg(not(target_os = "windows"))]
fn crypt(_: &[u8], _: bool) -> Result<Vec<u8>, String> { Err("Protected credential storage is currently supported on Windows only.".into()) }

#[cfg(all(test,target_os = "windows"))]
mod tests {
    use super::*;
    #[test] fn protects_synthetic_password() {
        let password = "synthetic-test-only".to_string();
        let encrypted = protect_connection_secret(password.clone()).unwrap();
        assert!(!encrypted.windows(password.len()).any(|part| part == password.as_bytes()));
        assert_eq!(unprotect_connection_secret(encrypted).unwrap(), password);
        assert!(unprotect_connection_secret(vec![1,2,3]).is_err());
    }
}

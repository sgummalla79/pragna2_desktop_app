fn main() {
    // Rerun when icon files change so Windows embeds the updated .ico immediately.
    println!("cargo:rerun-if-changed=icons/icon.ico");
    println!("cargo:rerun-if-changed=icons-brand/icon.ico");
    tauri_build::build()
}

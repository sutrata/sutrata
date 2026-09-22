use tauri::{AppHandle, Wry};
use tauri::menu::{Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder};

pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(&MenuItemBuilder::new("New").id("file:new").accelerator("CmdOrCtrl+N").build(app)?)
        .item(&MenuItemBuilder::new("Open...").id("file:open").accelerator("CmdOrCtrl+O").build(app)?)
        .separator()
        .item(&MenuItemBuilder::new("Save").id("file:save").accelerator("CmdOrCtrl+S").build(app)?)
        .item(&MenuItemBuilder::new("Save As...").id("file:saveAs").accelerator("CmdOrCtrl+Shift+S").build(app)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Exit"))?)
        .build()?;

    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, Some("Undo"))?)
        .item(&PredefinedMenuItem::redo(app, Some("Redo"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("Cut"))?)
        .item(&PredefinedMenuItem::copy(app, Some("Copy"))?)
        .item(&PredefinedMenuItem::paste(app, Some("Paste"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("Select All"))?)
        .separator()
        .item(&MenuItemBuilder::new("Find...").id("edit:find").accelerator("CmdOrCtrl+F").build(app)?)
        .item(&MenuItemBuilder::new("Replace...").id("edit:replace").accelerator("CmdOrCtrl+H").build(app)?)
        .separator()
        .item(&MenuItemBuilder::new("Toggle Source View").id("edit:toggleSource").accelerator("CmdOrCtrl+Shift+E").build(app)?)
        .item(&MenuItemBuilder::new("Toggle Toolbar").id("edit:toggleRibbon").accelerator("CmdOrCtrl+Shift+H").build(app)?)
        .item(&MenuItemBuilder::new("Toggle Navigator").id("edit:toggleNav").accelerator("CmdOrCtrl+Shift+B").build(app)?)
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(&MenuItemBuilder::new("Zoom In").id("view:zoomIn").accelerator("CmdOrCtrl+Equal").build(app)?)
        .item(&MenuItemBuilder::new("Zoom Out").id("view:zoomOut").accelerator("CmdOrCtrl+Minus").build(app)?)
        .item(&MenuItemBuilder::new("Reset Zoom").id("view:resetZoom").accelerator("CmdOrCtrl+0").build(app)?)
        .separator()
        .item(&MenuItemBuilder::new("Toggle Full Screen").id("view:fullscreen").accelerator("F11").build(app)?)
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, Some("Minimize"))?)
        .item(&PredefinedMenuItem::close_window(app, Some("Close"))?)
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::new("Learn More").id("help:learn").build(app)?)
        .build()?;

    let menu = Menu::with_items(app, &[
        &file_menu,
        &edit_menu,
        &view_menu,
        &window_menu,
        &help_menu,
    ])?;

    Ok(menu)
}

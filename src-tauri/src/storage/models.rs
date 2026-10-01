use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct CommandGroup {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SavedCommand {
    pub id: String,
    pub group_id: Option<String>,
    pub name: String,
    pub command: String,
    pub notes: String,
    pub shell_type: String, // "powershell" | "cmd"
    pub is_dangerous: bool,
    pub position: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandInput {
    pub id: Option<String>,
    pub group_id: Option<String>,
    pub name: String,
    pub command: String,
    pub notes: Option<String>,
    pub shell_type: String,
    pub is_dangerous: bool,
    pub position: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryPayload {
    pub groups: Vec<CommandGroup>,
    pub commands: Vec<SavedCommand>,
    pub settings: std::collections::HashMap<String, String>,
}

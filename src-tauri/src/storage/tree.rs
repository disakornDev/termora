use rusqlite::Connection;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum TreeError {
    #[error("Cycle detected: a group cannot be moved into itself or into its own descendant")]
    CycleDetected,
    #[error("Database error: {0}")]
    DbError(#[from] rusqlite::Error),
}

/// Validates whether moving `group_id` under `target_parent_id` is allowed.
///
/// A group can NEVER be moved:
/// 1. Into itself (`group_id == target_parent_id`)
/// 2. Into one of its own descendants (which would create a cycle / disconnected loop)
pub fn validate_group_move(
    conn: &Connection,
    group_id: &str,
    target_parent_id: Option<&str>,
) -> Result<(), TreeError> {
    let target = match target_parent_id {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Ok(()), // Moving to root level is always safe
    };

    if group_id == target {
        return Err(TreeError::CycleDetected);
    }

    // Traverse ancestors of target_parent_id up to the root.
    // If group_id is found anywhere in the path, it's a cycle!
    let mut current_id = target.to_string();
    loop {
        let mut stmt = conn.prepare("SELECT parent_id FROM groups WHERE id = ?1")?;
        let mut rows = stmt.query([&current_id])?;

        if let Some(row) = rows.next()? {
            let parent_id: Option<String> = row.get(0)?;
            match parent_id {
                Some(p) => {
                    if p == group_id {
                        return Err(TreeError::CycleDetected);
                    }
                    current_id = p;
                }
                None => break, // Reached root level
            }
        } else {
            break; // Target node not found (or root)
        }
    }

    Ok(())
}

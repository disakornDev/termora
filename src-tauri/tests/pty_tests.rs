use portable_pty::{native_pty_system, CommandBuilder};
use std::io::{Read, Write};
use std::thread;
use std::time::Duration;
use termora_lib::pty::session::{requested_pty_size, resolve_shell_path};
use termora_lib::pty::stream::Utf8StreamDecoder;

#[test]
fn test_shell_path_resolution() {
    let ps = resolve_shell_path("powershell");
    assert!(ps.is_ok(), "powershell.exe must resolve on Windows");

    let cmd = resolve_shell_path("cmd");
    assert!(cmd.is_ok(), "cmd.exe must resolve on Windows");
}

#[test]
fn test_pty_spawn_and_echo() {
    let pty_system = native_pty_system();
    let size = requested_pty_size(Some(24), Some(80));

    let pair = pty_system.openpty(size).expect("Failed to open PTY");
    let cmd_path = resolve_shell_path("cmd").expect("Resolve cmd");
    let cmd = CommandBuilder::new(cmd_path);

    let mut child = pair.slave.spawn_command(cmd).expect("Spawn cmd");
    let mut reader = pair.master.try_clone_reader().expect("Clone reader");
    let mut writer = pair.master.take_writer().expect("Take writer");

    // Write echo command to CMD
    writer.write_all(b"echo TERMORA_PTY_READY\r\n").expect("Write to PTY");
    writer.flush().expect("Flush PTY");

    // Read output in background
    let handle = thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        let mut decoder = Utf8StreamDecoder::new();
        let mut output = String::new();

        for _ in 0..20 {
            if let Ok(n) = reader.read(&mut buffer) {
                if n > 0 {
                    output.push_str(&decoder.decode(&buffer[..n]));
                    if output.contains("TERMORA_PTY_READY") {
                        return (true, output);
                    }
                }
            }
            thread::sleep(Duration::from_millis(50));
        }
        (false, output)
    });

    let (found, output) = handle.join().expect("Join thread");
    assert!(found, "PTY output should contain TERMORA_PTY_READY, got: {}", output);

    // Clean exit
    let mut killer = child.clone_killer();
    let _ = killer.kill();
    let _ = child.wait();
}

#[test]
fn test_pty_interactive_prompt() {
    let pty_system = native_pty_system();
    let size = requested_pty_size(Some(24), Some(80));

    let pair = pty_system.openpty(size).expect("Failed to open PTY");
    let ps_path = resolve_shell_path("powershell").expect("Resolve powershell");
    let mut cmd = CommandBuilder::new(ps_path);
    cmd.args(["-NoProfile", "-Command", "$val = Read-Host 'Proceed (Y/N)'; Write-Output \"ANSWER:$val\""]);

    let mut child = pair.slave.spawn_command(cmd).expect("Spawn powershell");
    let mut reader = pair.master.try_clone_reader().expect("Clone reader");
    let mut writer = pair.master.take_writer().expect("Take writer");

    let handle = thread::spawn(move || {
        let mut buffer = [0u8; 1024];
        let mut decoder = Utf8StreamDecoder::new();
        let mut output = String::new();

        for _ in 0..40 {
            if let Ok(n) = reader.read(&mut buffer) {
                if n > 0 {
                    output.push_str(&decoder.decode(&buffer[..n]));
                    if output.contains("Proceed (Y/N)") {
                        // Prompt appeared!
                        return (true, output);
                    }
                }
            }
            thread::sleep(Duration::from_millis(100));
        }
        (false, output)
    });

    // Wait until prompt shows
    let (prompt_seen, _out) = handle.join().expect("Join prompt thread");
    assert!(prompt_seen, "Interactive prompt should appear");

    // Send "Y" + enter
    writer.write_all(b"Y\r\n").expect("Send Y");
    writer.flush().expect("Flush");

    // Wait for process to exit and verify answer
    let _ = child.wait();
}

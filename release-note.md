# v0.2.5 - แก้บัก Local Stderr และ Cache Scoping

### สิ่งที่เปลี่ยนแปลงและแก้ไข

*   **แก้ปัญหา Local MCP Stderr รั่วไหล:** เปลี่ยนพฤติกรรมเริ่มต้นของ child process สำหรับ local MCP server ให้ใช้โหมด pipe เพื่อหลีกเลี่ยง log รกหน้าจอ โดยเมื่อเชื่อมต่อไม่สำเร็จจึงจะตัด log 8KB ล่าสุดออกมาแสดง พร้อมทั้งเพิ่ม config `stderr: "inherit"` เพื่อเป็นทางเลือกในการดึง logs แบบเรียลไทม์
*   **แก้ปัญหา Auto-Update Cache Scoping:** แก้ไขฟังก์ชันทำลาย cache โดยเสาะหาและลบเฉพาะโฟลเดอร์เพ็กเกจ `@openstellar/mcp-adapter` แทนที่จะลบทั้งโฟลเดอร์ scope `@openstellar` ของโครงการอื่นทั้งหมด
*   **แก้ปัญหาตรวจสอบเวอร์ชัน:** ปรับปรุงฟังก์ชัน `isNewerVersion` เพื่อกรองเวอร์ชันแบบละเว้นข้อมูล prerelease และ build metadata เพื่อให้ตรวจสอบเวอร์ชันหลักได้อย่างเสถียร

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.4...v0.2.5

# v0.2.4 - ระบบตรวจสอบและอัปเดตเวอร์ชันอัตโนมัติ

### สิ่งที่เปลี่ยนแปลงและแก้ไข

*   **Auto-Update Check:** ดึงข้อมูลของอแดปเตอร์จาก NPM Registry มาตรวจสอบเวอร์ชันและจัดการล้างแคชฝั่งผู้ใช้งานเพื่ออัปเดตทันทีหากเวอร์ชันใหม่พร้อมใช้งาน
*   **การแจ้งเตือน:** แสดงข้อความแจ้งเตือน (toast alerts) เพื่อให้ผู้ใช้ทำการรีสตาร์ท OpenCode เมื่อพบอแดปเตอร์รุ่นใหม่กว่า

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.3...v0.2.4

# v0.2.3 - ข้อมูลระบบแบบไดนามิก และปิดบัก JSON Schema Log

### สิ่งที่เปลี่ยนแปลงและแก้ไข

*   **Dynamic Handshake Version:** อ่านเวอร์ชันจริงโดยตรงจาก `package.json` มาระหว่างการทำแฮนด์เชคกับโมเดลผ่าน `clientInfo` (ปรับปรุงจากเดิมที่เป็น hardcoded v0.1.0)
*   **ลดทอนการล็อก JSON Schema:** ลบ debug logging ที่มักรันออกมาแจ้งเตือนบ่อย ๆ ในตอนวิเคราะห์ schema structure

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.2...v0.2.3

# v0.2.2: ปิดโหลดเซิร์ฟเวอร์ด้วย Enabled Flag และปรับลด log รบกวน

### สิ่งที่เปลี่ยนแปลงและแก้ไข

*   **Honoring the enabled flag:** ตัว Adapter ตรวจเช็คค่า `enabled` ใน config อย่างถูกต้องแล้ว หากเซ็ต `enabled: false` ไว้ ระบบจะข้ามการโหลด MCP server ตัวนั้นทันที ช่วยประหยัดทรัพยากรและไม่เผลอรันสิ่งที่เราปิดไปแล้ว
*   **Silent ref Fallback Logs:** ปรับลดระดับการแจ้งเตือนเวลาเจอ JSON Schema ที่ใช้ `$ref` จากเดิมที่เป็น `console.warn` ให้ลงไปเป็น `console.debug` แทน เนื่องจากเป็นพฤติกรรมการทำงานของ fallback ปกติ
*   **Type Safety Improvement:** อัปเดต TypeScript interface (`McpConfigEntry`) ให้รองรับ `enabled?: boolean` อย่างถูกต้อง เพื่อป้องกัน Type Error ฝั่งผู้ใช้งาน
*   **Dynamic Tests Added:** เปลี่ยนวิธีการเขียน Test ให้เป็นแบบ Dynamic เพื่อทดสอบพฤติกรรมการคัดกรองของ Adapter โดยตรงแทนการทดสอบแบบกำหนดชื่อแบบตายตัว

---
**Full Changelog**: https://github.com/open-stl/openstellar-mcp-adapter/compare/v0.2.1...v0.2.2

package com.wifisentry.core

import org.junit.Assert.*
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder

class PinnedStorageTest {

    @get:Rule
    val tmp = TemporaryFolder()

    private lateinit var storage: PinnedStorage

    @Before
    fun setup() {
        storage = PinnedStorage(tmp.newFile("pinned.json"))
    }

    @Test fun `empty file returns empty list`() {
        assertEquals(emptyList<PinnedNetwork>(), storage.loadPinned())
    }

    @Test fun `pin and load roundtrip`() {
        val net = PinnedNetwork(bssid = "AA:BB:CC:DD:EE:FF", ssid = "TestNet", pinnedAtMs = 1_000L)
        storage.pin(net)
        val loaded = storage.loadPinned()
        assertEquals(1, loaded.size)
        assertEquals("AA:BB:CC:DD:EE:FF", loaded[0].bssid)
        assertEquals("TestNet", loaded[0].ssid)
    }

    @Test fun `pin returns true for new pin`() {
        val net = PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1")
        assertTrue(storage.pin(net))
    }

    @Test fun `pin returns false when replacing existing BSSID`() {
        val net = PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1")
        storage.pin(net)
        val updated = PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1-renamed")
        assertFalse(storage.pin(updated))
    }

    @Test fun `replacing existing pin updates ssid`() {
        storage.pin(PinnedNetwork("AA:BB:CC:DD:EE:FF", "OldName"))
        storage.pin(PinnedNetwork("AA:BB:CC:DD:EE:FF", "NewName"))
        assertEquals(1, storage.loadPinned().size)
        assertEquals("NewName", storage.loadPinned()[0].ssid)
    }

    @Test fun `unpin removes by bssid`() {
        storage.pin(PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1"))
        storage.pin(PinnedNetwork("11:22:33:44:55:66", "Net2"))
        storage.unpin("AA:BB:CC:DD:EE:FF")
        val loaded = storage.loadPinned()
        assertEquals(1, loaded.size)
        assertEquals("11:22:33:44:55:66", loaded[0].bssid)
    }

    @Test fun `unpin is noop for unknown bssid`() {
        storage.pin(PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1"))
        storage.unpin("00:00:00:00:00:00")
        assertEquals(1, storage.loadPinned().size)
    }

    @Test fun `isPinned returns true for pinned bssid`() {
        storage.pin(PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1"))
        assertTrue(storage.isPinned("AA:BB:CC:DD:EE:FF"))
    }

    @Test fun `isPinned returns false for unknown bssid`() {
        assertFalse(storage.isPinned("00:00:00:00:00:00"))
    }

    @Test fun `clearAll removes all pins`() {
        storage.pin(PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1"))
        storage.pin(PinnedNetwork("11:22:33:44:55:66", "Net2"))
        storage.clearAll()
        assertEquals(emptyList<PinnedNetwork>(), storage.loadPinned())
    }

    @Test fun `note is persisted`() {
        storage.pin(PinnedNetwork("AA:BB:CC:DD:EE:FF", "Net1", note = "Suspicious AP on 3rd floor"))
        assertEquals("Suspicious AP on 3rd floor", storage.loadPinned()[0].note)
    }

    @Test fun `multiple pins ordered newest first after second pin`() {
        val older = PinnedNetwork("AA:BB:CC:DD:EE:FF", "Older", pinnedAtMs = 1_000L)
        val newer = PinnedNetwork("11:22:33:44:55:66", "Newer", pinnedAtMs = 2_000L)
        storage.pin(older)
        storage.pin(newer)
        // Newer was pinned last so it is at index 0 (prepended)
        assertEquals("11:22:33:44:55:66", storage.loadPinned()[0].bssid)
    }
}

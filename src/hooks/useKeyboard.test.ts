/**
 * Tests for useKeyboard hooks
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useKeyboard, useKeyboardShortcuts, useFocusTrap, useRovingTabIndex } from "./useKeyboard";
import { useRef } from "react";

describe("useKeyboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("basic functionality", () => {
    it("should call callback when key is pressed", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("escape", callback));

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should not call callback when different key is pressed", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("escape", callback));

      const event = new KeyboardEvent("keydown", { key: "Enter" });
      window.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
    });

    it("should handle case-insensitive key matching", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("k", callback));

      const event = new KeyboardEvent("keydown", { key: "K" });
      window.dispatchEvent(event);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("modifier keys", () => {
    it("should handle ctrl modifier", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("ctrl+k", callback));

      // Without ctrl - should not trigger
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: false }));
      expect(callback).not.toHaveBeenCalled();

      // With ctrl - should trigger
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle meta/cmd modifier", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("meta+k", callback));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle cmd alias for meta", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("cmd+k", callback));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle alt modifier", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("alt+k", callback));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", altKey: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle shift modifier", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("shift+k", callback));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", shiftKey: true }));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("should handle multiple modifiers", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("ctrl+shift+k", callback));

      // Only ctrl - should not trigger
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
      expect(callback).not.toHaveBeenCalled();

      // Both ctrl and shift - should trigger
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, shiftKey: true })
      );
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("options", () => {
    it("should not call callback when disabled", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("escape", callback, { enabled: false }));

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(callback).not.toHaveBeenCalled();
    });

    it("should prevent default when option is set", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("escape", callback, { preventDefault: true }));

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      const preventDefaultSpy = vi.spyOn(event, "preventDefault");

      window.dispatchEvent(event);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it("should stop propagation when option is set", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("escape", callback, { stopPropagation: true }));

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      const stopPropagationSpy = vi.spyOn(event, "stopPropagation");

      window.dispatchEvent(event);
      expect(stopPropagationSpy).toHaveBeenCalled();
    });
  });

  describe("input handling", () => {
    it("should not trigger in input elements (except escape)", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("k", callback));

      const input = document.createElement("input");
      document.body.appendChild(input);

      const event = new KeyboardEvent("keydown", { key: "k" });
      Object.defineProperty(event, "target", { value: input });
      window.dispatchEvent(event);

      expect(callback).not.toHaveBeenCalled();
      document.body.removeChild(input);
    });

    it("should trigger escape in input elements", () => {
      const callback = vi.fn();
      renderHook(() => useKeyboard("escape", callback));

      const input = document.createElement("input");
      document.body.appendChild(input);

      const event = new KeyboardEvent("keydown", { key: "Escape" });
      Object.defineProperty(event, "target", { value: input });
      window.dispatchEvent(event);

      expect(callback).toHaveBeenCalledTimes(1);
      document.body.removeChild(input);
    });
  });

  describe("cleanup", () => {
    it("should remove event listener on unmount", () => {
      const callback = vi.fn();
      const { unmount } = renderHook(() => useKeyboard("escape", callback));

      unmount();

      window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      expect(callback).not.toHaveBeenCalled();
    });
  });
});

describe("useKeyboardShortcuts", () => {
  it("should handle multiple shortcuts", () => {
    const searchCallback = vi.fn();
    const helpCallback = vi.fn();

    renderHook(() =>
      useKeyboardShortcuts({
        "ctrl+k": searchCallback,
        "ctrl+/": helpCallback,
      })
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(searchCallback).toHaveBeenCalledTimes(1);
    expect(helpCallback).not.toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "/", ctrlKey: true }));
    expect(helpCallback).toHaveBeenCalledTimes(1);
  });

  it("should prevent default by default", () => {
    renderHook(() =>
      useKeyboardShortcuts({
        "ctrl+k": vi.fn(),
      })
    );

    const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    window.dispatchEvent(event);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it("should respect enabled option", () => {
    const callback = vi.fn();
    renderHook(() =>
      useKeyboardShortcuts(
        {
          "ctrl+k": callback,
        },
        { enabled: false }
      )
    );

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(callback).not.toHaveBeenCalled();
  });
});

describe("useFocusTrap", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should focus first focusable element when enabled", () => {
    const button1 = document.createElement("button");
    const button2 = document.createElement("button");
    container.appendChild(button1);
    container.appendChild(button2);

    const focusSpy = vi.spyOn(button1, "focus");

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it("should not focus when disabled", () => {
    const button = document.createElement("button");
    container.appendChild(button);

    const focusSpy = vi.spyOn(button, "focus");

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, false);
      return ref;
    });

    expect(focusSpy).not.toHaveBeenCalled();
  });

  it("should trap focus on Tab at last element", () => {
    const button1 = document.createElement("button");
    const button2 = document.createElement("button");
    container.appendChild(button1);
    container.appendChild(button2);

    renderHook(() => {
      const ref = useRef<HTMLDivElement>(container);
      useFocusTrap(ref, true);
      return ref;
    });

    // Simulate focus on last element
    button2.focus();

    // Simulate Tab keydown
    const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true });
    const preventDefaultSpy = vi.spyOn(event, "preventDefault");

    container.dispatchEvent(event);

    // Should prevent default and focus first element
    expect(preventDefaultSpy).toHaveBeenCalled();
  });
});

describe("useRovingTabIndex", () => {
  let container: HTMLUListElement;
  let items: HTMLLIElement[];

  beforeEach(() => {
    container = document.createElement("ul");
    items = [];

    for (let i = 0; i < 3; i++) {
      const item = document.createElement("li");
      item.setAttribute("role", "menuitem");
      item.setAttribute("tabindex", i === 0 ? "0" : "-1");
      container.appendChild(item);
      items.push(item);
    }

    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("should navigate down with ArrowDown", () => {
    renderHook(() => {
      const ref = useRef<HTMLUListElement>(container);
      useRovingTabIndex(ref, '[role="menuitem"]');
      return ref;
    });

    items[0].focus();

    const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true });
    container.dispatchEvent(event);

    expect(items[1].getAttribute("tabindex")).toBe("0");
    expect(items[0].getAttribute("tabindex")).toBe("-1");
  });

  it("should navigate up with ArrowUp", () => {
    renderHook(() => {
      const ref = useRef<HTMLUListElement>(container);
      useRovingTabIndex(ref, '[role="menuitem"]');
      return ref;
    });

    items[1].focus();

    const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true });
    container.dispatchEvent(event);

    expect(items[0].getAttribute("tabindex")).toBe("0");
    expect(items[1].getAttribute("tabindex")).toBe("-1");
  });

  it("should wrap to last when at first and pressing up", () => {
    renderHook(() => {
      const ref = useRef<HTMLUListElement>(container);
      useRovingTabIndex(ref, '[role="menuitem"]', { wrap: true });
      return ref;
    });

    items[0].focus();

    const event = new KeyboardEvent("keydown", { key: "ArrowUp", bubbles: true });
    container.dispatchEvent(event);

    expect(items[2].getAttribute("tabindex")).toBe("0");
    expect(items[0].getAttribute("tabindex")).toBe("-1");
  });

  it("should jump to first on Home", () => {
    renderHook(() => {
      const ref = useRef<HTMLUListElement>(container);
      useRovingTabIndex(ref, '[role="menuitem"]');
      return ref;
    });

    items[2].focus();

    const event = new KeyboardEvent("keydown", { key: "Home", bubbles: true });
    container.dispatchEvent(event);

    expect(items[0].getAttribute("tabindex")).toBe("0");
  });

  it("should jump to last on End", () => {
    renderHook(() => {
      const ref = useRef<HTMLUListElement>(container);
      useRovingTabIndex(ref, '[role="menuitem"]');
      return ref;
    });

    items[0].focus();

    const event = new KeyboardEvent("keydown", { key: "End", bubbles: true });
    container.dispatchEvent(event);

    expect(items[2].getAttribute("tabindex")).toBe("0");
  });

  it("should use horizontal navigation when specified", () => {
    renderHook(() => {
      const ref = useRef<HTMLUListElement>(container);
      useRovingTabIndex(ref, '[role="menuitem"]', { horizontal: true });
      return ref;
    });

    items[0].focus();

    const event = new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true });
    container.dispatchEvent(event);

    expect(items[1].getAttribute("tabindex")).toBe("0");
  });
});

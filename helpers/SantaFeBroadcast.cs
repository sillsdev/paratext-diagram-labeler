using System;
using System.Runtime.InteropServices;

class Program
{
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern uint RegisterWindowMessage(string lpString);
    
    [DllImport("user32.dll")]
    static extern bool PostMessage(IntPtr hWnd, uint Msg, IntPtr wParam, IntPtr lParam);
    
    static int Main(string[] args)
    {
        try
        {
            Console.WriteLine("Registering SantaFeFocus message...");
            uint msgId = RegisterWindowMessage("SantaFeFocus");
            Console.WriteLine("Message ID: " + msgId);
            
            if (msgId == 0)
            {
                Console.WriteLine("ERROR: RegisterWindowMessage failed");
                return 1;
            }
            
            Console.WriteLine("Broadcasting message...");
            bool result = PostMessage((IntPtr)0xFFFF, msgId, (IntPtr)1, IntPtr.Zero);
            Console.WriteLine("PostMessage result: " + result);
            
            if (result)
            {
                Console.WriteLine("SUCCESS: SantaFeFocus broadcast completed");
                return 0;
            }
            else
            {
                Console.WriteLine("ERROR: PostMessage failed");
                return 1;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine("EXCEPTION: " + ex.Message);
            return 1;
        }
    }
}

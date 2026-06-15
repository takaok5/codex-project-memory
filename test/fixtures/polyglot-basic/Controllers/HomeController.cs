using Demo.Services;

public class HomeController {
  [HttpGet("home")]
  public string Home() { return "ok"; }
}

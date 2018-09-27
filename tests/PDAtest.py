#-*- coding: UTF-8 -*- 
import os,sys
import unittest    
from testwa import webdriver
from testwa.webdriver.common.touch_action import TouchAction
from testwa.webdriver.common.multi_action import MultiAction
from time import sleep    
import unicodedata
import random
import subprocess

# Returns abs path relative to this file and not cwd    
PATH = lambda p: os.path.abspath(    
    os.path.join(os.path.dirname(__file__), p)    
)    
p = None

class TestwaTests(unittest.TestCase):    
    def setUp(self):  
        global wd,screenRatioX,screenRatioY,touchAction,p  
        if p:
            p.terminate()
            p.wait()
        p = subprocess.Popen(["C:\\Testwa\\Generator\\TestwaServer\\node.exe", "C:\\Testwa\\Generator\\TestwaServer\\build\\lib\\main.js"])
        sleep(10)
        desired_caps = {}    
        desired_caps['platformName'] = 'Android'    
        desired_caps['platformVersion'] = '5.1'    
        desired_caps['deviceName'] = 'MT66-2WA-8D00375'
        desired_caps['unicodeKeyboard'] = True
        desired_caps['resetKeyboard'] = True
        desired_caps['app'] = PATH('C:/Users/Administrator/Downloads/pda-debug.apk')    
        desired_caps['appPackage'] = 'com.chanjet.tpluspda'
        desired_caps['appActivity'] = 'com.chanjet.tpluspda.activity.login.GuideActivity'
        desired_caps['appWaitPackage'] = 'com.chanjet.tpluspda'
        #desired_caps['appWaitActivity'] = 'com.chanjet.tpluspda.activity.login.GuideActivity'
        desired_caps['newCommandTimeout'] = 3600
        desired_caps['noReset'] = True

        global wd,screenRatioX,screenRatioY,touchAction
        self.driver = webdriver.Remote('http://127.0.0.1:4723/wd/hub', desired_caps)
        wd = self.driver
        wd.implicitly_wait(60)       
        touchAction = TouchAction(wd)

        #record device width*height
        originScreenWidth = 480.0
        originScreenHeight = 800.0    
        windows_size = wd.get_window_size()  
        currentWidth = windows_size.get('width')
        currentHeight = windows_size.get('height')
        screenRatioX = currentWidth/originScreenWidth
        screenRatioY = currentHeight/originScreenHeight
    
    def tearDown(self):    
        wd.quit()
        global p
        p = subprocess.Popen(["C:\\Testwa\\Generator\\TestwaServer\\node.exe", "C:\\Testwa\\Generator\\TestwaServer\\build\\lib\\main.js"])
        if p:
            p.terminate()
    
    def testTestwa(self):
        global wd,screenRatioX,screenRatioY,touchAction,p
        reload(sys)
        sys.setdefaultencoding( "utf-8" )
                
        
        #START_TO_RECORD_SCRIPT
        while True:
            try_time = 10;
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='1']/android.widget.ImageView[@index='0']").click()
        #sleep(2)
        #wd.find_element_by_xpath("//android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.TextView[@index='1']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='3']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.ScrollView[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='1']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.ImageView[@index='4']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='3']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.TextView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(10)
                wd.find_element_by_xpath("//android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='1']/android.widget.LinearLayout[@index='0']/android.widget.ImageView[@index='0']").click()
        #sleep(2)
        #wd.find_element_by_xpath("//android.widget.RelativeLayout[@index='0']/android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.LinearLayout[@index='0']/android.widget.CheckBox[@index='1']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.ImageView[@index='4']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='1']/android.widget.Button[@index='1']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.TextView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(10)
                wd.find_element_by_xpath("//android.widget.RelativeLayout[@index='0']/android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='2']/android.widget.ImageView[@index='0']").click()
        #sleep(2)
        #wd.find_element_by_xpath("//android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.TextView[@index='1']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.ImageView[@index='4']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.TextView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(10)
                wd.find_element_by_xpath("//android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='1']/android.widget.LinearLayout[@index='1']/android.widget.ImageView[@index='0']").click()
        #sleep(2)
        #wd.find_element_by_xpath("//android.widget.RelativeLayout[@index='0']/android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.LinearLayout[@index='0']/android.widget.CheckBox[@index='1']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.Button[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.ImageView[@index='4']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='2']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']/android.widget.LinearLayout[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.LinearLayout[@index='1']/android.widget.Button[@index='1']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(2)
                wd.find_element_by_xpath("//android.widget.RelativeLayout[@index='0']/android.widget.LinearLayout[@index='2']").click()
            except Exception as e:
                try_time = try_time - 1
            try:
                sleep(10)
                wd.find_element_by_xpath("//android.widget.RelativeLayout[@index='0']/android.widget.ImageView[@index='0']").click()
            except Exception as e:
                try_time = try_time - 1

            if try_time < 0:
                if p:
                    p.terminate()
                    p.wait()
                wd.quit()
                p = subprocess.Popen(["C:\\Testwa\\Generator\\TestwaServer\\node.exe", "C:\\Testwa\\Generator\\TestwaServer\\build\\lib\\main.js"])
                sleep(10)
                
                desired_caps = {}
                desired_caps['platformName'] = 'Android'
                desired_caps['platformVersion'] = '5.1'
                desired_caps['deviceName'] = 'MT66-2WA-8D00375'
                desired_caps['unicodeKeyboard'] = True
                desired_caps['resetKeyboard'] = True
                desired_caps['app'] = PATH('C:/Users/Administrator/Downloads/pda-debug.apk')
                desired_caps['appPackage'] = 'com.chanjet.tpluspda'
                desired_caps['appActivity'] = 'com.chanjet.tpluspda.activity.login.GuideActivity'
                desired_caps['appWaitPackage'] = 'com.chanjet.tpluspda'
                #desired_caps['appWaitActivity'] = 'com.chanjet.tpluspda.activity.login.GuideActivity'
                desired_caps['newCommandTimeout'] = 3600
                desired_caps['noReset'] = True
                
                self.driver = webdriver.Remote('http://127.0.0.1:4723/wd/hub', desired_caps)
                wd = self.driver
                wd.implicitly_wait(60)
                touchAction = TouchAction(wd)
                print 'restart...'


if __name__ == '__main__':    
    unittest.main(verbosity=2)

